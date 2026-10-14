"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../app/supabase'; 
import { useToast } from './ui/Avisos';

interface VentasProps {
  stock: any[];
  setStock: React.Dispatch<React.SetStateAction<any[]>>;
  ventas: any[];
  setVentas: React.Dispatch<React.SetStateAction<any[]>>;
  darkMode?: boolean; 
}

export default function Ventas({ stock, setStock, ventas, setVentas, darkMode = true }: VentasProps) {
  const toast = useToast();
  const { confirmar } = toast;
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cantidadSeleccionada, setCantidadSeleccionada] = useState(1);
  const [variedadElegidaPorProducto, setVariedadElegidaPorProducto] = useState<Record<string, string>>({});
  const [ticketFinal, setTicketFinal] = useState<any>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  
  const [descuento, setDescuento] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  const [listaSeleccionada, setListaSeleccionada] = useState<'precio_minorista' | 'precio_promo'>('precio_minorista');

  // Control de zoom para el artículo seleccionado del carrito
  const [imagenZoom, setImagenZoom] = useState<any>(null);

  // Control del porcentaje masivo para el carrito
  const [porcentajeAjuste, setPorcentajeAjuste] = useState<string>('');

  // Paginación para historial minorista
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const itemsPorPaginaHistorial = 10;

  const [isMobile, setIsMobile] = useState(false);
  const buscadorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const theme = {
    card: darkMode ? '#1e293b' : '#ffffff',
    bg: darkMode ? '#0f172a' : '#f8fafc',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    input: darkMode ? '#0f172a' : '#ffffff',
    innerBox: darkMode ? '#0f172a' : '#f1f5f9'
  };

  const cardStyle: React.CSSProperties = { 
    backgroundColor: theme.card, padding: isMobile ? '16px' : '25px', borderRadius: '20px', 
    boxShadow: darkMode ? '0 4px 15px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.05)', 
    borderTop: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`, borderLeft: `1px solid ${theme.border}`,
    width: '100%'
  };

  const inputStyle: React.CSSProperties = { 
    padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`,
    backgroundColor: theme.input, color: theme.text, width: '100%', outline: 'none', fontSize: '16px'
  };

  const countBtnStyle: React.CSSProperties = {
    backgroundColor: darkMode ? '#334155' : '#e2e8f0', color: theme.text, border: 'none',
    width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  const claveCarrito = (item: any) => `${item.id}::${item.variedad_id || ''}`;
  const obtenerVariedades = (producto: any): any[] => Array.isArray(producto?.variedades) ? producto.variedades : [];
  const precioDe = (producto: any, variedad: any, campo: 'precio_costo' | 'precio_mayorista' | 'precio_minorista') => {
    const valorVariedad = variedad?.[campo];
    const valor = valorVariedad !== undefined && valorVariedad !== null && valorVariedad !== '' ? valorVariedad : producto?.[campo];
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };
  const promoDe = (producto: any, variedad: any) => String(variedad?.precio_promo ?? producto?.precio_promo ?? '').trim();
  const variedadDe = (producto: any, item: any) => obtenerVariedades(producto).find((v: any) => String(v.id) === String(item.variedad_id)) || null;

  const carritoConPreciosVivos = useMemo(() => {
    return carrito.map(item => {
      if (item.precioModificado) return item;

      const itemStock = stock.find(s => s.id === item.id);
      const variedad = itemStock ? variedadDe(itemStock, item) : null;
      const precioOriginal = itemStock ? precioDe(itemStock, variedad, 'precio_minorista') : Number(item.precio_original_minorista || 0);
      const textoPromo = itemStock ? promoDe(itemStock, variedad) : '';
      let precioCalculado = precioOriginal;
      let aplicaPromoAlgoritmica = false;

      if (textoPromo) {
        const promoStr = textoPromo.toLowerCase();
        const match = promoStr.match(/(?:x)?(\d+)\s*x\s*(\d+)|(\d+)\s*x\s*(\d+)/) || promoStr.match(/x(\d+)\s+(\d+)/);

        if (match) {
          const unidadesPromoRequeridas = parseInt(match[1] || match[3], 10);
          const precioTotalPromo = parseInt(match[2] || match[4], 10);
          if (unidadesPromoRequeridas > 0 && item.unidades >= unidadesPromoRequeridas) {
            aplicaPromoAlgoritmica = true;
            const cantidadDePacks = Math.floor(item.unidades / unidadesPromoRequeridas);
            const unidadesSueltas = item.unidades % unidadesPromoRequeridas;
            precioCalculado = (cantidadDePacks * precioTotalPromo) + (unidadesSueltas * precioOriginal);
            precioCalculado /= item.unidades;
          }
        }
      }

      if (!aplicaPromoAlgoritmica && listaSeleccionada === 'precio_promo') {
        const precioPromo = Number(textoPromo);
        precioCalculado = Number.isFinite(precioPromo) && precioPromo > 0 ? precioPromo : precioOriginal;
      }

      return { ...item, precio_venta: precioCalculado, precio_promo_texto: textoPromo, esPromoAplicada: aplicaPromoAlgoritmica };
    });
  }, [carrito, listaSeleccionada, stock]);

  const subtotalCarrito = () => carritoConPreciosVivos.reduce((acc, item) => acc + (item.precio_venta * item.unidades), 0);
  const totalConDescuento = () => Math.max(0, subtotalCarrito() - descuento);

  const aplicarAjustePorcentualMasivo = (tipo: 'recargo' | 'descuento') => {
    const porcentaje = Number(porcentajeAjuste);
    if (isNaN(porcentaje) || porcentaje <= 0) {
      return toast.avisar("Por favor ingresá un número de porcentaje válido y mayor a 0.", 'alerta');
    }

    const factor = tipo === 'recargo' ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    const nuevoCarritoAjustado = carritoConPreciosVivos.map(item => {
      return {
        ...item,
        precio_venta: Math.round(item.precio_venta * factor),
        precioModificado: true 
      };
    });

    setCarrito(nuevoCarritoAjustado);
    setPorcentajeAjuste(''); 
  };

  const historialMinoristaFiltrado = useMemo(() => {
    return ventas.filter((v: any) => !v.cliente_id || v.cliente_nombre === 'Venta Minorista Mostrador');
  }, [ventas]);

  const totalPaginasHistorial = Math.ceil(historialMinoristaFiltrado.length / itemsPorPaginaHistorial);
  const historialPaginado = useMemo(() => {
    const inicio = (paginaHistorial - 1) * itemsPorPaginaHistorial;
    return historialMinoristaFiltrado.slice(inicio, inicio + itemsPorPaginaHistorial);
  }, [historialMinoristaFiltrado, paginaHistorial]);

  useEffect(() => {
    const buscarEnBaseDeDatos = async () => {
      if (busqueda.trim().length > 0) {
        const { data } = await supabase
          .from('stock')
          .select('id, nombre, codigo, precio_minorista, precio_costo, precio_promo, imagen_url, variedades')
          .or(`nombre.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`)
          .limit(10);

        if (data) {
          setSugerencias(data);
          setMostrarSugerencias(true);
          const coincidenciaExacta = data.find(
            item => item.codigo && item.codigo.toLowerCase() === busqueda.trim().toLowerCase()
          );
          if (coincidenciaExacta) {
            const tieneVariedades = obtenerVariedades(coincidenciaExacta).length > 0;
            if (!tieneVariedades) ejecutarAgregadoDirecto(coincidenciaExacta, cantidadSeleccionada);
          }
        }
      } else {
        setSugerencias([]);
        setMostrarSugerencias(false);
      }
    };
    const delayDebounce = setTimeout(() => { buscarEnBaseDeDatos(); }, 200);
    return () => clearTimeout(delayDebounce);
  }, [busqueda]);

  const ejecutarAgregadoDirecto = (producto: any, cantidad: number, variedadId?: string) => {
    const variedades = obtenerVariedades(producto);
    const idElegido = variedadId || variedadElegidaPorProducto[producto.id] || '';
    const variedadObj = variedades.find((v: any) => String(v.id) === String(idElegido)) || null;
    if (variedades.length > 0 && !variedadObj) {
      toast.avisar('Elegí una variedad antes de agregar el producto al carrito.', 'alerta');
      return;
    }

    const nuevoItem = {
      id: producto.id,
      nombre: producto.nombre,
      variedad_id: variedadObj?.id || null,
      variedad_nombre: variedadObj?.nombre || null,
      imagen: variedadObj?.imagen_url || producto.imagen_url,
      precio_original_minorista: precioDe(producto, variedadObj, 'precio_minorista'),
      unidades: cantidad,
      precioModificado: false
    };
    const clave = claveCarrito(nuevoItem);

    setCarrito(prevCarrito => {
      const existe = prevCarrito.find(item => claveCarrito(item) === clave);
      if (existe) {
        return prevCarrito.map(item => claveCarrito(item) === clave ? { ...item, unidades: item.unidades + cantidad } : item);
      }
      return [...prevCarrito, nuevoItem];
    });
    if (variedadObj) setVariedadElegidaPorProducto(prev => ({ ...prev, [producto.id]: variedadObj.id }));
    setBusqueda('');
    setSugerencias([]);
    setMostrarSugerencias(false);
    setCantidadSeleccionada(1);
  };

  const manejarCambioPrecioInput = (clave: string, nuevoValor: string) => {
    const num = Number(nuevoValor);
    setCarrito(prevCarrito => prevCarrito.map(c =>
      claveCarrito(c) === clave ? { ...c, precio_venta: isNaN(num) ? 0 : num, precioModificado: true } : c
    ));
  };

  const cambiarUnidadesManual = (clave: string, cambio: number) => {
    setCarrito(prevCarrito => prevCarrito.map(item => {
      if (claveCarrito(item) === clave) {
        const nuevasUnidades = item.unidades + cambio;
        return nuevasUnidades > 0 ? { ...item, unidades: nuevasUnidades } : null;
      }
      return item;
    }).filter(Boolean) as any[]);
  };

  const manejarCambioUnidadesInput = (clave: string, valor: string) => {
    const num = Math.max(1, parseInt(valor, 10) || 1);
    setCarrito(prevCarrito => prevCarrito.map(item => claveCarrito(item) === clave ? { ...item, unidades: num } : item));
  };

  const imprimirTicketVenta = (datos: any) => {
    const windowUrl = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!windowUrl) return;
    windowUrl.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; font-size: 13px; font-weight: bold; color: #000; }
            .text-center { text-align: center; }
            .divider { border-top: 2px dashed #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3>PUEBLOS DEL MUNDO</h3>
            <div>MOVIMIENTO: TICKET MINORISTA MOSTRADOR</div>
            <div>Fecha: ${datos.fecha}</div>
          </div>
          <div class="divider"></div>
          ${datos.items.map((i: any) => `<div>${i.unidades}x ${i.nombre} ->$${(i.unidades * (i.precio_venta || i.precio_original_minorista || 0)).toLocaleString('es-AR')}</div>`).join('')}
          <div class="divider"></div>
          <div>SUBTOTAL OPERACIÓN: $${Number(datos.subtotal || 0).toLocaleString('es-AR')}</div>
          ${datos.descuento > 0 ? `<div>DESCUENTO DIRECTO: -$${Number(datos.descuento || 0).toLocaleString('es-AR')}</div>` : ''}
          <div style="font-size:15px; margin-top: 5px;">TOTAL PAGADO: $${Number(datos.total || 0).toLocaleString('es-AR')}</div>
          <div class="text-center" style="margin-top:15px;">PAGO: ${datos.metodo_pago.toUpperCase()}</div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    windowUrl.document.close();
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    try {
      const finalTotal = totalConDescuento();
      const nuevaVenta = {
        id: Date.now(),
        fecha: new Date().toLocaleString('es-AR'),
        items: carritoConPreciosVivos,
        subtotal: subtotalCarrito(),
        descuento,
        total: finalTotal,
        metodo_pago: metodoPago,
        cliente_id: null,
        cliente_nombre: 'Venta Minorista Mostrador',
        // Se removió "tipo: 'minorista'" para evitar el rechazo de Supabase
        estado: 'completada'
      };
      
      const { error } = await supabase.from('ventas').insert([nuevaVenta]);
      if (error) throw error;

      setVentas([nuevaVenta, ...ventas]);
      setTicketFinal(nuevaVenta);
      imprimirTicketVenta(nuevaVenta);
      setCarrito([]);
      setDescuento(0);
      setMetodoPago('Efectivo');
      setListaSeleccionada('precio_minorista');
    } catch (e: any) { toast.error("Error al registrar venta minorista: " + e.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: theme.text, fontWeight: '800', margin: 0 }}>💰 Módulo de Ventas Mostrador</h2>
        <button
          onClick={() => setVerHistorial(!verHistorial)}
          style={{ backgroundColor: verHistorial ? '#ef4444' : '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
        >
          {verHistorial ? '✕ VOLVER AL PANEL VIVO' : '📜 VER HISTORIAL'}
        </button>
      </div>

      {verHistorial ? (
        /* --- HISTORIAL DE COMPROBANTES MINORISTAS --- */
        <div style={cardStyle}>
          <h3 style={{ color: '#10b981', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>📜 Historial de Operaciones Minoristas (Mostrador)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {historialMinoristaFiltrado.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: 'center', padding: '40px' }}>No hay transacciones de mostrador registradas en la jornada.</p>
            ) : (
              historialPaginado.map((v: any) => (
                <div 
                  key={v.id} 
                  style={{ 
                    backgroundColor: theme.innerBox, padding: '16px 20px', borderRadius: '14px', 
                    border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', 
                    alignItems: 'center', flexWrap: 'wrap', gap: '15px' 
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: theme.text, fontWeight: 'bold', fontSize: '1.05rem' }}>🛍️ Venta Mostrador Común</span>
                      <span style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '6px' }}>
                        {v.metodo_pago}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '5px' }}>
                      📅 {v.fecha} • Líneas: {Array.isArray(v.items) ? v.items.reduce((acc: number, i: any) => acc + (i.unidades || 1), 0) : 1} u.
                      {v.descuento > 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>(-${Number(v.descuento).toLocaleString('es-AR')} Descto)</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#10b981', fontSize: '1.25rem' }}>
                      ${Number(v.total || 0).toLocaleString('es-AR')}
                    </div>
                    <button
                      onClick={() => imprimirTicketVenta(v)}
                      style={{ backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.card; e.currentTarget.style.color = theme.text; }}
                    >
                      🖨️ REIMPRIMIR
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINACIÓN HISTORIAL */}
          {totalPaginasHistorial > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '25px', paddingTop: '15px', borderTop: `1px solid ${theme.border}` }}>
              <button disabled={paginaHistorial === 1} onClick={() => setPaginaHistorial(paginaHistorial - 1)} style={{ background: 'none', border: 'none', color: paginaHistorial === 1 ? theme.subtext : '#10b981', cursor: paginaHistorial === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>◀ Ant</button>
              {Array.from({ length: totalPaginasHistorial }, (_, i) => i + 1).map((num) => (
                <button key={num} onClick={() => setPaginaHistorial(num)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: paginaHistorial === num ? '#10b981' : theme.innerBox, color: paginaHistorial === num ? '#ffffff' : theme.text }}>{num}</button>
              ))}
              <button disabled={paginaHistorial === totalPaginasHistorial} onClick={() => setPaginaHistorial(paginaHistorial + 1)} style={{ background: 'none', border: 'none', color: paginaHistorial === totalPaginasHistorial ? theme.subtext : '#10b981', cursor: paginaHistorial === totalPaginasHistorial ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Sig ▶</button>
            </div>
          )}
        </div>
      ) : (
        /* PANEL OPERATIVO VIVO ORIGINAL */
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', flex: 1 }}>
            
            {/* BUSCADOR */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  ref={buscadorRef}
                  type="text"
                  placeholder="Escanee o busque producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {mostrarSugerencias && (
                <div style={{ marginTop: '12px', border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden', backgroundColor: theme.card }}>
                  {/* Cabecera del panel de resultados */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase', color: theme.subtext }}>
                      🔎 Resultados {sugerencias.length > 0 && `(${sugerencias.length})`}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: theme.subtext }}>Clic para agregar al carrito</span>
                  </div>

                  {sugerencias.length === 0 ? (
                    <div style={{ padding: '26px', textAlign: 'center', color: theme.subtext }}>
                      <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>🔍</div>
                      Sin resultados para <strong style={{ color: theme.text }}>"{busqueda}"</strong>
                    </div>
                  ) : (
                    <>
                      {/* Encabezado de columnas */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${theme.border}` }}>
                        <span style={{ flex: 1, fontSize: '0.66rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.subtext }}>Producto</span>
                        <span style={{ width: '110px', textAlign: 'right', fontSize: '0.66rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.subtext }}>Precio</span>
                        <span style={{ width: '36px' }} />
                      </div>

                       {sugerencias.map(s => {
                         const variedades = obtenerVariedades(s);
                         const variedadId = variedadElegidaPorProducto[s.id] || '';
                         const variedad = variedades.find((v: any) => String(v.id) === String(variedadId)) || null;
                         return (
                           <div
                             key={s.id}
                             onClick={() => ejecutarAgregadoDirecto(s, cantidadSeleccionada, variedadId || undefined)}
                             style={{
                               display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                               cursor: 'pointer', borderBottom: `1px solid ${theme.border}`, transition: 'background 0.15s ease'
                             }}
                             onMouseEnter={e => (e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9')}
                             onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                           >
                             <div style={{
                               width: '42px', height: '42px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0,
                               backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               border: `1px solid ${theme.border}`
                             }}>
                               {s.imagen_url
                                 ? <img src={s.imagen_url} alt={s.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                 : <span style={{ fontSize: '1.2rem' }}>📦</span>
                               }
                             </div>

                             <div style={{ flex: 1, minWidth: 0 }}>
                               <div style={{ color: theme.text, fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                 {s.nombre}
                               </div>
                               {s.codigo && (
                                 <div style={{ fontSize: '0.7rem', color: theme.subtext, fontFamily: 'monospace' }}>
                                   Código: {s.codigo}
                                 </div>
                               )}
                               {variedades.length > 0 && (
                                 <select
                                   value={variedadId}
                                   onClick={e => e.stopPropagation()}
                                   onChange={e => setVariedadElegidaPorProducto(prev => ({ ...prev, [s.id]: e.target.value }))}
                                   style={{ ...inputStyle, marginTop: '5px', padding: '5px 7px', fontSize: '0.75rem' }}
                                 >
                                   <option value="">Elegí una variedad</option>
                                   {variedades.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                 </select>
                               )}
                             </div>

                             <strong style={{ width: variedades.length > 0 ? '125px' : '110px', textAlign: 'right', color: '#10b981', fontFamily: 'monospace', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                               ${precioDe(s, variedad, 'precio_minorista').toLocaleString('es-AR')}
                             </strong>

                             <span style={{ width: '36px', display: 'flex', justifyContent: 'flex-end' }}>
                               <span style={{ width: '24px', height: '24px', borderRadius: '8px', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '900' }}>+</span>
                             </span>
                           </div>
                         );
                       })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* CARRITO */}
            <div style={cardStyle}>
              <h3 style={{ color: theme.subtext, fontSize: '0.9rem', marginTop: 0 }}>🛒 ARTÍCULOS EN CARRITO</h3>

              {carritoConPreciosVivos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: theme.subtext }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛒</div>
                  <div>El carrito está vacío</div>
                </div>
              )}

              {carritoConPreciosVivos.map(item => (
                <div
                   key={claveCarrito(item)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', padding: '14px 0',
                    borderBottom: `1px solid ${theme.border}`, color: theme.text, alignItems: 'center', gap: '12px'
                  }}
                >
                  <div 
                    onClick={() => setImagenZoom(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0,
                      backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${theme.border}`
                    }}>
                      {item.imagen
                        ? <img src={item.imagen} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                         <span style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {item.nombre}{item.variedad_nombre ? ` · ${item.variedad_nombre}` : ''}
                         </span>
                        
                        {item.precio_promo_texto && (
                          <span style={{ 
                            backgroundColor: item.esPromoAplicada ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.12)', 
                            color: item.esPromoAplicada ? '#10b981' : '#f43f5e', 
                            fontSize: '0.78rem', padding: '3px 9px', borderRadius: '6px', fontWeight: 'bold',
                            border: item.esPromoAplicada ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(244,63,94,0.2)',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.esPromoAplicada ? `✅ Pack: ${item.precio_promo_texto}` : `🎁 Promo: ${item.precio_promo_texto}`}
                          </span>
                        )}
                      </div>
                      
                      <div 
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>Precio unitario:</span>
                        <input 
                          type="number" 
                          value={Math.round(item.precio_venta)} 
                          onChange={e => manejarCambioPrecioInput(claveCarrito(item), e.target.value)}
                          style={{
                            ...inputStyle, width: '90px', padding: '4px 8px',
                            display: 'inline-block', marginBottom: 0, fontWeight: 'bold',
                            color: item.esPromoAplicada || item.precioModificado ? '#10b981' : theme.text
                          }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: theme.innerBox, borderRadius: '8px', padding: '2px' }}>
                      <button type="button" onClick={() => cambiarUnidadesManual(claveCarrito(item), -1)} style={countBtnStyle}>-</button>
                      <input
                        type="number"
                        value={item.unidades}
                        min="1"
                        onChange={e => manejarCambioUnidadesInput(claveCarrito(item), e.target.value)}
                        style={{ ...inputStyle, width: '50px', border: 'none', textAlign: 'center', backgroundColor: 'transparent', fontWeight: 'bold' }}
                      />
                      <button type="button" onClick={() => cambiarUnidadesManual(claveCarrito(item), 1)} style={countBtnStyle}>+</button>
                    </div>
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#10b981' }}>
                      ${Math.round(item.precio_venta * item.unidades).toLocaleString()}
                    </strong>
                  </div>
                </div>
              ))}

              {/* TOTALES Y ACCIONES */}
              {carrito.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div style={{ 
                    backgroundColor: theme.innerBox, 
                    padding: '16px', 
                    borderRadius: '12px', 
                    border: `1px dashed ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: theme.text }}>
                      ⚡ AJUSTE PORCENTUAL MASIVO SOBRE EL CARRITO
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                      <input 
                        type="number" 
                        placeholder="Ej: 10 para 10%" 
                        value={porcentajeAjuste}
                        onChange={e => setPorcentajeAjuste(e.target.value)}
                        style={{ ...inputStyle, flex: 1, backgroundColor: theme.card }}
                        min="1"
                      />
                      <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                        <button 
                          type="button"
                          onClick={() => aplicarAjustePorcentualMasivo('recargo')}
                          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                          ▲ Recargar %
                        </button>
                        <button 
                          type="button"
                          onClick={() => aplicarAjustePorcentualMasivo('descuento')}
                          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                          ▼ Descontar %
                        </button>
                      </div>
                    </div>
                  </div>

                  <select value={listaSeleccionada} onChange={e => setListaSeleccionada(e.target.value as any)} style={inputStyle}>
                    <option value="precio_minorista">🍏 Tarifa Minorista Estándar</option>
                    <option value="precio_promo">🔥 Forzar Lista Promociones</option>
                  </select>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
                    <input
                      type="number"
                      placeholder="Descuento manual $"
                      value={descuento}
                      onChange={e => setDescuento(Number(e.target.value))}
                      style={inputStyle}
                    />
                    <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
                      <option>Efectivo</option>
                      <option>Transferencia</option>
                      <option>Tarjeta</option>
                      <option>Cuenta Corriente</option>
                    </select>
                  </div>

                  {descuento > 0 && (
                    <div style={{ textAlign: 'right', fontSize: '0.9rem', color: theme.subtext }}>
                      Subtotal: ${subtotalCarrito().toLocaleString()} — Descuento: -${descuento.toLocaleString()}
                    </div>
                  )}

                  <div style={{ textAlign: 'right', padding: '15px', backgroundColor: theme.innerBox, borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>
                      TOTAL CAJA: ${totalConDescuento().toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={finalizarVenta}
                    style={{
                      backgroundColor: '#10b981', color: '#fff', border: 'none',
                      padding: '18px', borderRadius: '10px', fontWeight: '900',
                      cursor: 'pointer', width: '100%', fontSize: '1.1rem'
                    }}
                  >
                    ✅ COMPLETAR OPERACIÓN
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RESUMEN LATERAL */}
          {ticketFinal && (
            <div style={{ position: isMobile ? 'static' : 'sticky', top: '20px', width: isMobile ? '100%' : '320px' }}>
              <div style={cardStyle}>
                <h4 style={{ color: theme.text, marginBottom: '10px', marginTop: 0 }}>Último Ticket Emitido</h4>
                <p style={{ color: theme.subtext, fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Monto neto: <strong style={{ color: '#10b981' }}>${ticketFinal.total.toLocaleString()}</strong><br />
                  Medio pago: <strong>{ticketFinal.metodo_pago}</strong><br />
                  Tipo: <strong>Minorista Mostrador</strong>
                </p>
                <button
                  onClick={() => imprimirTicketVenta(ticketFinal)}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#334155', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🖨️ RE-IMPRIMIR TICKET
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal flotante de vista ampliada */}
      {imagenZoom && (
        <div
          onClick={() => setImagenZoom(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
            backdropFilter: 'blur(5px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: theme.card, borderRadius: '24px', width: '100%',
              maxWidth: '480px', border: `1px solid ${theme.border}`, overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative'
            }}
          >
            <div style={{ width: '100%', height: '320px', backgroundColor: theme.innerBox, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {imagenZoom.imagen ? (
                <img src={imagenZoom.imagen} alt={imagenZoom.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '5rem' }}>📦</span>
              )}
            </div>
            <div style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: theme.text, fontSize: '1.3rem', fontWeight: '800' }}>{imagenZoom.nombre}</h3>
              <p style={{ color: theme.subtext, fontSize: '0.9rem', margin: 0 }}>
                Valor unitario líquido actual: <strong style={{ color: '#10b981' }}>${Math.round(imagenZoom.precio_venta).toLocaleString()}</strong>
              </p>
            </div>
            <button
              onClick={() => setImagenZoom(null)}
              style={{
                position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)',
                border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}