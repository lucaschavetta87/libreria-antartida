"use client";
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Avisos';

const CAMPOS_PRECIO = [
  { id: 'precio_costo', label: '💼 Costo' },
  { id: 'precio_iva', label: '➕ +IVA' },
  { id: 'precio_mayorista', label: '🏢 Mayorista' },
  { id: 'precio_minorista', label: '🛒 Minorista' },
];

const MODOS_IDENTIFICACION = [
  { id: 'nombre', label: 'Por Nombre' },
  { id: 'codigo', label: 'Por Código / EAN' },
  { id: 'ambos', label: 'Nombre o Código' },
];

export default function ActualizarPrecios({ isOpen, onClose, categorias, subcategorias, stock, setStock, darkMode }: any) {
  const toast = useToast();
  const { confirmar } = toast;
  const [archivoNombre, setArchivoNombre] = useState('');
  const [libroTrabajo, setLibroTrabajo] = useState<XLSX.WorkBook | null>(null);
  const [hojas, setHojas] = useState<string[]>([]);
  const [hojaSeleccionada, setHojaSeleccionada] = useState('');
  const [datosCrudos, setDatosCrudos] = useState<any[][]>([]);
  const [filaCabecera, setFilaCabecera] = useState<number>(0);
  const [columnasDetectadas, setColumnasDetectadas] = useState<string[]>([]);

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState('');

  const [colCodigo, setColCodigo] = useState<string>('');
  const [colNombre, setColNombre] = useState<string>('');
  const [modoIdentificacion, setModoIdentificacion] = useState('nombre');

  const [colPrecio, setColPrecio] = useState<string>('');
  const [campoPrecio, setCampoPrecio] = useState('precio_mayorista');

  const [preview, setPreview] = useState<any[]>([]);
  const [sinCambios, setSinCambios] = useState(0);
  const [noMatcheados, setNoMatcheados] = useState<string[]>([]);
  const [previewListo, setPreviewListo] = useState(false);

  const [aplicando, setAplicando] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewListo(false);
      setResultadoFinal('');
      setPreview([]);
      setSinCambios(0);
      setNoMatcheados([]);
      setArchivoNombre('');
      setLibroTrabajo(null);
      setHojas([]);
      setHojaSeleccionada('');
      setDatosCrudos([]);
      setFilaCabecera(0);
      setColumnasDetectadas([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const themeBg = darkMode ? '#1e293b' : '#ffffff';
  const themeText = darkMode ? '#f8fafc' : '#0f172a';
  const themeBorder = darkMode ? '#334155' : '#cbd5e1';
  const themeInput = darkMode ? '#0f172a' : '#f8fafc';

  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setArchivoNombre(archivo.name);
    const lector = new FileReader();
    lector.readAsArrayBuffer(archivo);
    lector.onload = (evento) => {
      try {
        const datosBuffer = evento.target?.result as ArrayBuffer;
        const libro = XLSX.read(datosBuffer, { type: 'array' });
        setLibroTrabajo(libro);
        setHojas(libro.SheetNames);
        if (libro.SheetNames.length > 0) {
          seleccionarHoja(libro, libro.SheetNames[0]);
        }
      } catch (err) {
        toast.error("Error al leer el archivo Excel.");
      }
    };
  };

  const seleccionarHoja = (libro: XLSX.WorkBook, nombreHoja: string) => {
    setHojaSeleccionada(nombreHoja);
    const hoja = libro.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json<any>(hoja, { header: 1, defval: '' }) as any[][];
    setDatosCrudos(filas);
    setPreviewListo(false);

    let idxCabecera = 0;
    for (let i = 0; i < Math.min(20, filas.length); i++) {
       const f = filas[i];
       if (f.filter(c => String(c).trim().length > 2).length >= 3) {
          idxCabecera = i;
          break;
       }
    }
    establecerFilaCabecera(filas, idxCabecera);
  };

  const establecerFilaCabecera = (filas: any[][], idx: number) => {
    setFilaCabecera(idx);
    setPreviewListo(false);
    const maxCols = filas.length > 0 ? Math.max(1, ...filas.slice(0, 50).map(r => r.length || 0)) : 1;
    const cabeceras = Array.from({ length: maxCols }).map((_, i) => {
      const cell = filas[idx]?.[i];
      return cell ? String(cell).trim() : `Columna ${i + 1}`;
    });
    setColumnasDetectadas(cabeceras);

    let cNom = '', cCod = '', cPrec = '';
    cabeceras.forEach((c, i) => {
       const min = c.toLowerCase();
       if ((min.includes('ean') || min.includes('cod') || min.includes('barra')) && cCod === '') cCod = i.toString();
       if ((min.includes('nom') || min.includes('desc') || min.includes('prod') || min.includes('art')) && cNom === '') cNom = i.toString();
       if ((min.includes('prec') || min.includes('precio')) && cPrec === '') cPrec = i.toString();
    });
    setColNombre(cNom);
    setColCodigo(cCod);
    setColPrecio(cPrec);
  };

  const limpiarPrecio = (valor: any): number => {
    if (!valor) return 0;
    if (typeof valor === 'number') return Math.round(valor);
    let texto = String(valor).replace(/[^0-9.,]/g, '');
    if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
    else if (texto.includes(',')) texto = texto.replace(',', '.');
    return Math.round(parseFloat(texto)) || 0;
  };

  const subcategoriasFiltradas = (subcategorias || []).filter((s: any) => String(s.categoria).toLowerCase() === categoriaSeleccionada);
  const maxCols = datosCrudos.length > 0 ? Math.max(1, ...datosCrudos.slice(0, 50).map(r => r.length || 0)) : 1;

  const generarPreview = () => {
    if (!categoriaSeleccionada) {
      toast.avisar("Primero elegí en qué categoría/subcategoría querés actualizar los precios.", 'alerta');
      return;
    }
    if (colPrecio === '') {
      toast.avisar("Elegí cuál es la columna de precio del Excel.", 'alerta');
      return;
    }
    if (colNombre === '' && colCodigo === '' && modoIdentificacion !== 'codigo') {
      toast.avisar("Indicá la columna que identifica los productos (nombre o código).", 'alerta');
      return;
    }

    const fuera = new Set<string>();
    const stockFiltrado = (stock || []).filter((it: any) => {
      fuera.add(String(it.categoria || '').toLowerCase());
      return String(it.categoria || '').toLowerCase() === categoriaSeleccionada &&
        (subcategoriaSeleccionada ? String(it.subcategoria || '').toLowerCase().trim() === subcategoriaSeleccionada : true);
    });

    const mapaNombre = new Map<string, any>();
    const mapaCodigo = new Map<string, any>();
    stockFiltrado.forEach((item: any) => {
      if (item.nombre) mapaNombre.set(item.nombre.trim().toLowerCase(), item);
      if (item.codigo) mapaCodigo.set(item.codigo.trim().toLowerCase(), item);
      if (Array.isArray(item.variedades)) {
        item.variedades.forEach((v: any) => {
          if (v.nombre) mapaNombre.set(String(v.nombre).trim().toLowerCase(), item);
          if (v.codigo) mapaCodigo.set(String(v.codigo).trim().toLowerCase(), item);
        });
      }
    });

    const pendientes = new Map<string, any>();
    const idsPendientes = new Set<string>();
    const singoCambios = new Set();
    const noMatcheadosLista: string[] = [];
    let conCambiosCount = 0;
    let sinCambiosCount = 0;

    for (let i = filaCabecera + 1; i < datosCrudos.length; i++) {
      const row = datosCrudos[i];
      if (!row || row.length === 0) continue;

      const nombreKey = colNombre !== '' ? String(row[Number(colNombre)] || '').trim().toLowerCase() : '';
      const codigoKey = colCodigo !== '' ? String(row[Number(colCodigo)] || '').trim().toLowerCase() : '';
      const nomProd = colNombre !== '' ? String(row[Number(colNombre)] || '').trim() : '';
      if (!nombreKey && !codigoKey) continue;
      if (nomProd.toLowerCase().includes('nombre') || nomProd.toLowerCase().includes('precio')) continue;

      let productoEncontrado = null;
      let variedadDetectada = '';

      if (modoIdentificacion === 'nombre' || modoIdentificacion === 'ambos') {
        productoEncontrado = mapaNombre.get(nombreKey) || null;
      }
      if (!productoEncontrado && (modoIdentificacion === 'codigo' || modoIdentificacion === 'ambos') && codigoKey) {
        productoEncontrado = mapaCodigo.get(codigoKey) || null;
      }
      if (productoEncontrado && productoEncontrado.codigo && codigoKey && String(productoEncontrado.codigo).trim().toLowerCase() === codigoKey) {
        variedadDetectada = '';
      }

      if (productoEncontrado) {
        const nuevoPrecio = limpiarPrecio(row[Number(colPrecio)]);
        const precioViejo = Number(productoEncontrado[campoPrecio] || 0);
        const id = productoEncontrado.id;

        if (!idsPendientes.has(id) && precioViejo === nuevoPrecio) {
          singoCambios.add(id);
          sinCambiosCount++;
          continue;
        }
        idsPendientes.add(id);
        if (precioViejo !== nuevoPrecio) conCambiosCount++;
        pendientes.set(id, {
          id,
          nombre: productoEncontrado.nombre,
          codigo: productoEncontrado.codigo || '',
          variedadDetectada,
          precioViejo,
          precioNuevo: nuevoPrecio,
          cambio: precioViejo !== nuevoPrecio,
        });
      } else {
        noMatcheadosLista.push(nomProd || codigoKey);
      }
    }

    setPreview(Array.from(pendientes.values()));
    setSinCambios(singoCambios.size);
    setNoMatcheados(noMatcheadosLista);
    setPreviewListo(true);
  };

  const confirmarActualizacion = async () => {
    if (preview.length === 0) {
      toast.error("No hay productos para actualizar.");
      return;
    }
    const aActualizar = preview.filter((p: any) => p.cambio);
    setAplicando(true);
    try {
      let actualizados = 0;
      for (let i = 0; i < aActualizar.length; i += 200) {
        const chunk = aActualizar.slice(i, i + 200);
        for (const p of chunk) {
          const { error } = await supabase
            .from('stock')
            .update({ [campoPrecio]: p.precioNuevo, ultima_actualizacion: new Date().toLocaleString() })
            .eq('id', p.id);
          if (error) throw new Error(error.message);
          actualizados++;
        }
      }

      const { data: stockRefrescado } = await supabase.from('stock').select('*').order('nombre', { ascending: true });
      if (stockRefrescado) setStock(stockRefrescado);

      setResultadoFinal(`✅ Se actualizaron ${actualizados} productos de la base de datos. (${sinCambios} ya estaban al día y se ignoraron${noMatcheados.length > 0 ? `, ${noMatcheados.length} no matchearon esta carpeta` : ''}).`);
    } catch (err: any) {
      toast.error(`Error al actualizar: ${err.message}`, 8000);
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', padding: '20px' }}>
      <div style={{ backgroundColor: themeBg, color: themeText, borderRadius: '24px', width: '100%', maxWidth: '1000px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', border: `1px solid ${themeBorder}` }}>
        <div style={{ padding: '20px 30px', borderBottom: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>💰 Actualizar Precios con Excel</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeText, fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ padding: '25px 30px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* PASO 1: Carpeta destino */}
          <div style={{ border: `2px dashed ${categoriaSeleccionada ? '#059669' : '#f59e0b'}`, padding: '16px', borderRadius: '14px', background: darkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '8px', color: '#059669' }}>1. Categoría / Subcategoría donde actualizar (obligatorio):</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={categoriaSeleccionada} onChange={e => { setCategoriaSeleccionada(e.target.value); setSubcategoriaSeleccionada(''); setPreviewListo(false); }} style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                <option value="">(Elegí categoría)</option>
                {(categorias || []).map((c: any) => <option key={c.id} value={String(c.id).toLowerCase()}>{c.label}</option>)}
              </select>
              <select value={subcategoriaSeleccionada} onChange={e => { setSubcategoriaSeleccionada(e.target.value); setPreviewListo(false); }} disabled={!categoriaSeleccionada} style={{ flex: 1, minWidth: '160px', padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText, opacity: !categoriaSeleccionada ? 0.5 : 1 }}>
                <option value="">(Toda la categoría)</option>
                {subcategoriasFiltradas.map((s: any) => <option key={s.id} value={String(s.nombre).trim().toLowerCase()}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* PASO 2: Excel */}
          <div style={{ border: `2px dashed ${themeBorder}`, padding: '16px', borderRadius: '14px', textAlign: 'center', background: darkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '8px', color: '#3b82f6', textAlign: 'left' }}>2. Seleccionar archivo Excel:</label>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={manejarSeleccionArchivo} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 20px', borderRadius: '10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              {archivoNombre ? `📁 Cambiar archivo: ${archivoNombre}` : '📂 Seleccionar Archivo Excel'}
            </button>
          </div>

          {hojas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '6px', color: '#3b82f6' }}>3. Pestaña del Excel:</label>
                <select value={hojaSeleccionada} onChange={e => seleccionarHoja(libroTrabajo!, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                  {hojas.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '6px', color: '#3b82f6' }}>4. Identificar productos por:</label>
                <select value={modoIdentificacion} onChange={e => { setModoIdentificacion(e.target.value); setPreviewListo(false); }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                  {MODOS_IDENTIFICACION.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {columnasDetectadas.length > 0 && (
            <>
              <div>
                <label style={{ fontSize: '0.9rem', fontWeight: 800, display: 'block', marginBottom: '4px', color: '#3b82f6' }}>5. Hacé clic en la fila que contiene los TÍTULOS de la tabla:</label>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '200px', border: `1px solid ${themeBorder}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <tbody>
                      {datosCrudos.slice(0, 40).map((row, idx) => {
                        const esCabecera = idx === filaCabecera;
                        return (
                          <tr key={idx} onClick={() => establecerFilaCabecera(datosCrudos, idx)} style={{ backgroundColor: esCabecera ? '#3b82f6' : (darkMode ? '#1e293b' : '#fff'), color: esCabecera ? '#fff' : themeText, cursor: 'pointer', borderBottom: `1px solid ${themeBorder}` }}>
                            <td style={{ padding: '6px 10px', fontWeight: 'bold', borderRight: `1px solid ${themeBorder}` }}>{esCabecera ? '✔️ TÍTULOS' : idx + 1}</td>
                            {Array.from({ length: maxCols }).map((_, cIdx) => (
                              <td key={cIdx} style={{ padding: '6px 10px', borderRight: `1px solid ${themeBorder}` }}>{row[cIdx] !== undefined ? String(row[cIdx]) : ''}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${themeBorder}`, paddingTop: '15px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '10px', color: '#3b82f6' }}>6. Mapeo de columnas:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  {modoIdentificacion !== 'codigo' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Columna Nombre / Artículo:</label>
                      <select value={colNombre} onChange={e => { setColNombre(e.target.value); setPreviewListo(false); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                        <option value="">Ninguno</option>
                        {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                      </select>
                    </div>
                  )}
                  {modoIdentificacion !== 'nombre' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Columna Código / EAN:</label>
                      <select value={colCodigo} onChange={e => { setColCodigo(e.target.value); setPreviewListo(false); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                        <option value="">Ninguno</option>
                        {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Columna de PRECIO del Excel:</label>
                    <select value={colPrecio} onChange={e => { setColPrecio(e.target.value); setPreviewListo(false); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Seleccionar...</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Campo a actualizar en la BD:</label>
                    <select value={campoPrecio} onChange={e => { setCampoPrecio(e.target.value); setPreviewListo(false); }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      {CAMPOS_PRECIO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={generarPreview} disabled={!categoriaSeleccionada || colPrecio === ''} style={{ padding: '12px 22px', borderRadius: '10px', border: 'none', backgroundColor: categoriaSeleccionada && colPrecio !== '' ? '#059669' : '#64748b', color: '#fff', fontWeight: 'bold', cursor: categoriaSeleccionada && colPrecio !== '' ? 'pointer' : 'not-allowed' }}>
                  👁️ Ver previsualización de cambios
                </button>
              </div>
            </>
          )}

          {/* PASO 7: Previsualización + confirmación */}
          {previewListo && (
            <div style={{ borderTop: `2px dashed ${themeBorder}`, paddingTop: '18px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span style={{ padding: '8px 14px', borderRadius: '999px', backgroundColor: '#059669', color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>
                  🟡 A actualizar: {preview.filter((p: any) => p.cambio).length}
                </span>
                <span style={{ padding: '8px 14px', borderRadius: '999px', backgroundColor: darkMode ? '#334155' : '#e2e8f0', color: themeText, fontWeight: 800, fontSize: '0.82rem' }}>
                  🔵 Ya al día (se ignoran): {sinCambios}
                </span>
                <span style={{ padding: '8px 14px', borderRadius: '999px', backgroundColor: noMatcheados.length > 0 ? '#f59e0b' : (darkMode ? '#334155' : '#e2e8f0'), color: noMatcheados.length > 0 ? '#fff' : themeText, fontWeight: 800, fontSize: '0.82rem' }}>
                  ⚠️ No matchearon esta carpeta: {noMatcheados.length}
                </span>
              </div>

              {preview.length > 0 && (
                <div style={{ overflowX: 'auto', maxHeight: '300px', border: `1px solid ${themeBorder}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: darkMode ? '#111c33' : '#f1f5f9', color: themeText }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Producto</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Código</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Precio actual</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Precio nuevo</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((p: any) => {
                        const cambio = p.cambio;
                        return (
                          <tr key={p.id} style={{ borderTop: `1px solid ${themeBorder}`, backgroundColor: cambio ? (darkMode ? 'rgba(245,158,11,0.08)' : '#fffbeb') : 'transparent' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.nombre}{p.variedadDetectada ? ` · (${p.variedadDetectada})` : ''}</td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{p.codigo}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>${Number(p.precioViejo).toLocaleString()}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: cambio ? '#f59e0b' : themeText }}>${Number(p.precioNuevo).toLocaleString()}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: cambio ? '#f59e0b' : '#10b981' }}>{cambio ? '⏫ Se actualizará' : '= Sin cambios'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {noMatcheados.length > 0 && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>Ver filas del Excel que no matchearon ({noMatcheados.length})</summary>
                  <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', backgroundColor: darkMode ? 'rgba(245,158,11,0.08)' : '#fffbeb', border: `1px solid #f59e0b`, fontSize: '0.78rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {noMatcheados.map((n, i) => <div key={i}>• {n}</div>)}
                  </div>
                </details>
              )}

              {resultadoFinal && (
                <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: 700, fontSize: '14px', border: '1px solid #10b981' }}>
                  {resultadoFinal}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '18px 30px', borderTop: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: 'transparent', color: themeText, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
          {previewListo && (
            <button onClick={confirmarActualizacion} disabled={aplicando || preview.filter((p: any) => p.cambio).length === 0} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', backgroundColor: (aplicando || preview.filter((p: any) => p.cambio).length === 0) ? '#64748b' : '#059669', color: '#fff', fontWeight: 'bold', cursor: (aplicando || preview.filter((p: any) => p.cambio).length === 0) ? 'not-allowed' : 'pointer' }}>
              {aplicando ? 'Aplicando...' : `✅ Confirmar y Actualizar ${preview.filter((p: any) => p.cambio).length} precios`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}