"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../app/supabase'; 
import { useToast } from './ui/Avisos';

interface VentasMayoristasProps {
  stock: any[];
  setStock: React.Dispatch<React.SetStateAction<any[]>>;
  ventas: any[];
  setVentas: React.Dispatch<React.SetStateAction<any[]>>;
  darkMode?: boolean; 
}

export default function VentasMayoristas({ stock, setStock, ventas, setVentas, darkMode = true }: VentasMayoristasProps) {
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
  
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const [listaClientes, setListaClientes] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({ nombre: '', telefono: '', descuento_especial: '0' });

  // Estado para controlar el producto en zoom desde el carrito
  const [imagenZoom, setImagenZoom] = useState<any>(null);

  // Porcentaje masivo para el remito mayorista
  const [porcentajeAjuste, setPorcentajeAjuste] = useState<string>('');

  // Paginación interna para el historial mayorista
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
    border: `1px solid ${theme.border}`, width: '100%'
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
  const precioDe = (producto: any, variedad: any, campo: 'precio_costo' | 'precio_mayorista') => {
    const valorVariedad = variedad?.[campo];
    const valor = valorVariedad !== undefined && valorVariedad !== null && valorVariedad !== '' ? valorVariedad : producto?.[campo];
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };
  const variedadDe = (producto: any, item: any) => obtenerVariedades(producto).find((v: any) => String(v.id) === String(item.variedad_id)) || null;

  const Miniatura = ({ src, alt, size = 38 }: { src?: string; alt?: string; size?: number }) => (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '8px', overflow: 'hidden',
      flexShrink: 0, backgroundColor: theme.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${theme.border}`
    }}>
      {src
        ? <img src={src} alt={alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size > 40 ? '1.5rem' : '1.1rem' }}>📦</span>
      }
    </div>
  );

  useEffect(() => { obtenerClientes(); }, []);
  useEffect(() => { if (buscadorRef.current && !verHistorial) buscadorRef.current.focus(); }, [verHistorial]);

  const obtenerClientes = async () => {
    const { data, error } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
    if (!error && data) setListaClientes(data);
  };

  const infoClienteActivo = useMemo(() => {
    if (!clienteSeleccionado) return null;
    return listaClientes.find(c => c.id.toString() === clienteSeleccionado) || null;
  }, [clienteSeleccionado, listaClientes]);

  const carritoMayoristaConPrecios = useMemo(() => {
    return carrito.map(item => {
      if (item.precioModificado) return item;

      const itemStock = stock.find(s => s.id === item.id);
      const variedad = itemStock ? variedadDe(itemStock, item) : null;
      const precioMayoristaBase = itemStock
        ? precioDe(itemStock, variedad, 'precio_mayorista') || precioDe(itemStock, variedad, 'precio_costo')
        : Number(item.precio_original_mayorista || 0);
      return { ...item, precio_venta: precioMayoristaBase };
    });
  }, [carrito, stock]);

  const subtotalCarrito = () =>
    carritoMayoristaConPrecios.reduce((acc, item) => acc + (item.precio_venta * item.unidades), 0);

  const descuentoGremioCalculado = useMemo(() => {
    if (infoClienteActivo && Number(infoClienteActivo.descuento_especial) > 0) {
      const porcentaje = Number(infoClienteActivo.descuento_especial);
      return Math.round(subtotalCarrito() * (porcentaje / 100));
    }
    return 0;
  }, [carritoMayoristaConPrecios, infoClienteActivo]);

  const totalFinal = () => Math.max(0, subtotalCarrito() - descuentoGremioCalculado);

  const aplicarAjustePorcentualMasivo = (tipo: 'recargo' | 'descuento') => {
    const porcentaje = Number(porcentajeAjuste);
    if (isNaN(porcentaje) || porcentaje <= 0) {
      return toast.avisar("Por favor ingresá un número de porcentaje válido y mayor a 0.", 'alerta');
    }

    const factor = tipo === 'recargo' ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    const nuevoCarritoAjustado = carritoMayoristaConPrecios.map(item => {
      return {
        ...item,
        precio_venta: Math.round(item.precio_venta * factor),
        precioModificado: true 
      };
    });

    setCarrito(nuevoCarritoAjustado);
    setPorcentajeAjuste('');
  };

  // Historial filtrado para mayoristas (ventas que tienen un cliente_id asociado)
  const historialMayoristaFiltrado = useMemo(() => {
    return ventas.filter((v: any) => v.cliente_id !== null && v.cliente_id !== undefined && v.cliente_id !== '');
  }, [ventas]);

  const totalPaginasHistorial = Math.ceil(historialMayoristaFiltrado.length / itemsPorPaginaHistorial);
  const historialPaginado = useMemo(() => {
    const inicio = (paginaHistorial - 1) * itemsPorPaginaHistorial;
    return historialMayoristaFiltrado.slice(inicio, inicio + itemsPorPaginaHistorial);
  }, [historialMayoristaFiltrado, paginaHistorial]);

  const crearClienteExpress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoClienteForm.nombre.trim()) return;
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: nuevoClienteForm.nombre,
        telefono: nuevoClienteForm.telefono,
        saldo_cc: 0,
        descuento_especial: Number(nuevoClienteForm.descuento_especial) || 0
      }])
      .select();
    if (!error && data) {
      setListaClientes([...listaClientes, data[0]].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteSeleccionado(data[0].id.toString());
      setCreandoCliente(false);
      setNuevoClienteForm({ nombre: '', telefono: '', descuento_especial: '0' });
    }
  };

  useEffect(() => {
    const buscarEnBaseDeDatos = async () => {
      if (busqueda.trim().length > 0) {
        const { data } = await supabase
          .from('stock')
          .select('id, nombre, codigo, precio_mayorista, precio_costo, imagen_url, variedades')
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
      toast.avisar('Elegí una variedad antes de agregar el producto al remito.', 'alerta');
      return;
    }

    const nuevoItem = {
      id: producto.id,
      nombre: producto.nombre,
      variedad_id: variedadObj?.id || null,
      variedad_nombre: variedadObj?.nombre || null,
      imagen: variedadObj?.imagen_url || producto.imagen_url,
      precio_original_mayorista: precioDe(producto, variedadObj, 'precio_mayorista') || precioDe(producto, variedadObj, 'precio_costo'),
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

  const handleSumarManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (sugerencias.length > 0) ejecutarAgregadoDirecto(sugerencias[0], cantidadSeleccionada);
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
            <div>MOVIMIENTO: REMITO MAYORISTA</div>
            <div>Fecha: ${datos.fecha}</div>
            ${datos.cliente_nombre ? `<div>CLIENTE: ${datos.cliente_nombre}</div>` : ''}
          </div>
          <div class="divider"></div>
          ${datos.items.map((i: any) => `<div>${i.unidades}x ${i.nombre} -> $${(i.unidades * (i.precio_venta || i.precio_original_mayorista || 0)).toLocaleString('es-AR')}</div>`).join('')}
          <div class="divider"></div>
          <div>SUBTOTAL MAYORISTA: $${Number(datos.subtotal || 0).toLocaleString('es-AR')}</div>
          ${datos.descuento > 0 ? `<div>DESCUENTO ESPECIAL: -$${Number(datos.descuento || 0).toLocaleString('es-AR')}</div>` : ''}
          <div style="font-size:15px; margin-top: 5px;">TOTAL A PAGAR: $${Number(datos.total || 0).toLocaleString('es-AR')}</div>
          <div class="text-center" style="margin-top:15px;">PAGO: ${datos.metodo_pago.toUpperCase()}</div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    windowUrl.document.close();
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    if (!clienteSeleccionado) return toast.avisar("Las ventas mayoristas exigen vincular una ficha de cliente obligatoriamente.", 'alerta');

    try {
      const finalTotal = totalFinal();
      const clienteNombreStr = infoClienteActivo ? infoClienteActivo.nombre : '';

      if (metodoPago === 'Cuenta Corriente') {
        const saldoPrevio = Number(infoClienteActivo?.saldo_cc || 0);
        await supabase.from('clientes').update({ saldo_cc: saldoPrevio + finalTotal }).eq('id', Number(clienteSeleccionado));
      }

      // Se eliminó la propiedad "tipo" para evitar errores con el esquema de Supabase
      const nuevaVenta = { 
        id: Date.now(), 
        fecha: new Date().toLocaleString('es-AR'), 
        items: carritoMayoristaConPrecios, 
        subtotal: subtotalCarrito(), 
        descuento: descuentoGremioCalculado, 
        total: finalTotal, 
        metodo_pago: metodoPago, 
        cliente_id: Number(clienteSeleccionado), 
        cliente_nombre: clienteNombreStr, 
        estado: 'completada' 
      };

      const { error } = await supabase.from('ventas').insert([nuevaVenta]);
      if (error) throw error;

      setVentas([nuevaVenta, ...ventas]);
      setTicketFinal(nuevaVenta);
      imprimirTicketVenta(nuevaVenta);
      setCarrito([]);
      setClienteSeleccionado('');
      setMetodoPago('Transferencia');
      if (buscadorRef.current) buscadorRef.current.focus();
    } catch (error: any) {
      toast.error("Error al procesar remito: " + error.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: '#8b5cf6', fontWeight: '800', margin: 0 }}>🏢 Módulo de Ventas Mayoristas</h2>
        <button
          onClick={() => setVerHistorial(!verHistorial)}
          style={{ backgroundColor: verHistorial ? '#ef4444' : '#8b5cf6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
        >
          {verHistorial ? '✕ VOLVER AL PANEL VIVO' : '📜 VER HISTORIAL'}
        </button>
      </div>

      {verHistorial ? (
        /* --- RENDERIZADO DEL HISTORIAL DE VENTAS MAYORISTAS --- */
        <div style={cardStyle}>
          <h3 style={{ color: '#8b5cf6', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>📜 Historial de Remitos y Facturación al por Mayor</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {historialMayoristaFiltrado.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: 'center', padding: '40px' }}>No hay transacciones mayoristas registradas en el historial.</p>
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
                      <span style={{ color: theme.text, fontWeight: 'bold', fontSize: '1.05rem' }}>👤 {v.cliente_nombre || 'Cliente Gremio'}</span>
                      <span style={{ backgroundColor: v.metodo_pago === 'Cuenta Corriente' ? '#ef4444' : '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '6px' }}>
                        {v.metodo_pago}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '5px' }}>
                      📅 {v.fecha} • items: {Array.isArray(v.items) ? v.items.reduce((acc: number, i: any) => acc + (i.unidades || 1), 0) : 1} u.
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#8b5cf6', fontSize: '1.25rem' }}>
                      ${Number(v.total || 0).toLocaleString('es-AR')}
                    </div>
                    <button
                      onClick={() => imprimirTicketVenta(v)}
                      style={{ backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                      onMouseEnter={(e: any) => {
                        e.currentTarget.style.backgroundColor = '#8b5cf6';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e: any) => {
                        e.currentTarget.style.backgroundColor = theme.card;
                        e.currentTarget.style.color = theme.text;
                      }}
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
              <button disabled={paginaHistorial === 1} onClick={() => setPaginaHistorial(paginaHistorial - 1)} style={{ background: 'none', border: 'none', color: paginaHistorial === 1 ? theme.subtext : '#8b5cf6', cursor: paginaHistorial === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>◀ Ant</button>
              {Array.from({ length: totalPaginasHistorial }, (_, i) => i + 1).map((num) => (
                <button key={num} onClick={() => setPaginaHistorial(num)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: paginaHistorial === num ? '#8b5cf6' : theme.innerBox, color: paginaHistorial === num ? '#ffffff' : theme.text }}>{num}</button>
              ))}
              <button disabled={paginaHistorial === totalPaginasHistorial} onClick={() => setPaginaHistorial(paginaHistorial + 1)} style={{ background: 'none', border: 'none', color: paginaHistorial === totalPaginasHistorial ? theme.subtext : '#8b5cf6', cursor: paginaHistorial === totalPaginasHistorial ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Sig ▶</button>
            </div>
          )}
        </div>
      ) : (
        /* PANEL OPERATIVO ORIGINAL */
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', flex: 1 }}>
            
            {/* BUSCADOR */}
            <div style={cardStyle}>
              <form onSubmit={handleSumarManual} style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ flex: 2, position: 'relative', width: '100%' }}>
                    <input
                      ref={buscadorRef}
                      type="text"
                      placeholder="Buscar por código o nombre (Tarifa Mayorista Fija)..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      style={inputStyle}
                    />

                    {mostrarSugerencias && sugerencias.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '105%', left: 0, right: 0,
                        backgroundColor: theme.card, border: `1px solid ${theme.border}`,
                        zIndex: 10, borderRadius: '12px', maxHeight: '240px', overflowY: 'auto'
                      }}>
                         {sugerencias.map(s => {
                           const variedades = obtenerVariedades(s);
                           const variedadId = variedadElegidaPorProducto[s.id] || '';
                           const variedad = variedades.find((v: any) => String(v.id) === String(variedadId)) || null;
                           return (
                             <div
                               key={s.id}
                               onClick={() => ejecutarAgregadoDirecto(s, cantidadSeleccionada, variedadId || undefined)}
                               style={{
                                 padding: '10px 12px', cursor: 'pointer',
                                 borderBottom: `1px solid ${theme.border}`,
                                 display: 'flex', justifyContent: 'space-between',
                                 alignItems: 'center', color: theme.text, gap: '10px'
                               }}
                               onMouseEnter={e => (e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9')}
                               onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                             >
                               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                 <Miniatura src={s.imagen_url} alt={s.nombre} size={38} />
                                 <div style={{ minWidth: 0 }}>
                                   <span style={{ fontWeight: '500' }}>{s.nombre}</span>
                                   {variedades.length > 0 && (
                                     <select
                                       value={variedadId}
                                       onClick={e => e.stopPropagation()}
                                       onChange={e => setVariedadElegidaPorProducto(prev => ({ ...prev, [s.id]: e.target.value }))}
                                       style={{ ...inputStyle, marginTop: '4px', padding: '5px 7px', fontSize: '0.75rem' }}
                                     >
                                       <option value="">Elegí una variedad</option>
                                       {variedades.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                     </select>
                                   )}
                                 </div>
                               </div>
                               <span style={{ color: '#8b5cf6', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                                 Mayorista: ${(precioDe(s, variedad, 'precio_mayorista') || precioDe(s, variedad, 'precio_costo')).toLocaleString('es-AR')}
                               </span>
                             </div>
                           );
                         })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      value={cantidadSeleccionada}
                      onChange={e => setCantidadSeleccionada(Number(e.target.value))}
                      style={{ ...inputStyle, width: '70px', textAlign: 'center' }}
                      min="1"
                    />
                    <button
                      type="submit"
                      style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '10px', padding: '0 25px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      AÑADIR
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* CARRITO MAYORISTA */}
            <div style={cardStyle}>
              <h3 style={{ marginBottom: '15px', color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', marginTop: 0 }}>
                🛒 DETALLE DE ARTÍCULOS (PRECIOS MAYORISTAS)
              </h3>

              {carrito.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: theme.subtext }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📦</div>
                  <div>No hay artículos cargados en el remito.</div>
                </div>
              )}
              
              {carritoMayoristaConPrecios.map(item => (
                <div
                   key={claveCarrito(item)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 0', borderBottom: `1px solid ${theme.border}`,
                    color: theme.text, gap: '12px'
                  }}
                >
                  <div 
                    onClick={() => setImagenZoom(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  >
                    <Miniatura src={item.imagen} alt={item.nombre} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: '600', fontSize: '1.05rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                         {item.nombre}{item.variedad_nombre ? ` · ${item.variedad_nombre}` : ''}
                      </span>
                      <div 
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>Precio Base Mayorista:</span>
                        <input
                          type="number"
                          value={Math.round(item.precio_venta)}
                          onChange={e => manejarCambioPrecioInput(claveCarrito(item), e.target.value)}
                          style={{
                            ...inputStyle, width: '90px', padding: '4px 8px',
                            display: 'inline-block', fontFamily: 'monospace', fontWeight: 'bold',
                            color: item.precioModificado ? '#10b981' : '#8b5cf6'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: theme.innerBox, padding: '2px', borderRadius: '8px' }}>
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
                      <button
                        onClick={() => setCarrito(prevCarrito => prevCarrito.filter(c => claveCarrito(c) !== claveCarrito(item)))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}
                      >❌</button>
                    </div>
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#8b5cf6' }}>
                      ${Math.round(item.precio_venta * item.unidades).toLocaleString()}
                    </strong>
                  </div>
                </div>
              ))}

              {/* TOTALES */}
              {carrito.length > 0 && (
                <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
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
                      ⚡ AJUSTE PORCENTUAL MASIVO SOBRE TARIFA MAYORISTA
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                      <input 
                        type="number" 
                        placeholder="Ej: 12 para un recargo del 12%" 
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

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>MÉTODO DE PAGO</label>
                      <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
                        <option>Transferencia</option>
                        <option>Efectivo</option>
                        <option>Tarjeta</option>
                        <option>Cuenta Corriente</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>DESCUENTO ASIGNADO (GREMIO)</label>
                      <input
                        type="text"
                        value={`$${descuentoGremioCalculado.toLocaleString()} (-${infoClienteActivo ? infoClienteActivo.descuento_especial : 0}%)`}
                        style={{ ...inputStyle, border: '1px solid #8b5cf6', fontFamily: 'monospace', fontWeight: 'bold' }}
                        disabled
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>
                        👤 ASIGNAR CLIENTE MAYORISTA (OBLIGATORIO)
                      </label>
                      <button
                        type="button"
                        onClick={() => setCreandoCliente(!creandoCliente)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {creandoCliente ? '✕ Cancelar' : '➕ Nuevo Mayorista'}
                      </button>
                    </div>

                    {creandoCliente ? (
                      <form onSubmit={crearClienteExpress} style={{ display: 'flex', gap: '10px', backgroundColor: theme.bg, padding: '14px', borderRadius: '12px', border: `1px solid ${theme.border}`, flexDirection: 'column' }}>
                        <input type="text" placeholder="Razón Social / Nombre" required value={nuevoClienteForm.nombre} onChange={e => setNuevoClienteForm({ ...nuevoClienteForm, nombre: e.target.value })} style={inputStyle} />
                        <input type="text" placeholder="Teléfono / Contacto" value={nuevoClienteForm.telefono} onChange={e => setNuevoClienteForm({ ...nuevoClienteForm, telefono: e.target.value })} style={inputStyle} />
                        <input type="number" placeholder="Descuento sobre Mayorista (%)" value={nuevoClienteForm.descuento_especial} onChange={e => setNuevoClienteForm({ ...nuevoClienteForm, descuento_especial: e.target.value })} style={inputStyle} min="0" max="100" />
                        <button type="submit" style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Registrar Mayorista
                        </button>
                      </form>
                    ) : (
                      <select
                        value={clienteSeleccionado}
                        onChange={e => setClienteSeleccionado(e.target.value)}
                        style={{ ...inputStyle, border: !clienteSeleccionado ? '2px solid #ef4444' : `1px solid ${theme.border}` }}
                      >
                        <option value="">-- Seleccionar Cuenta de Cliente Mayorista --</option>
                        {listaClientes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} [Dcto: {c.descuento_especial}%] • Saldo CC: ${Number(c.saldo_cc || 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', backgroundColor: theme.bg, padding: '15px', borderRadius: '15px', border: `1px solid ${theme.border}` }}>
                    {descuentoGremioCalculado > 0 && (
                      <div style={{ fontSize: '0.9rem', color: theme.subtext, marginBottom: '6px' }}>
                        Subtotal: ${subtotalCarrito().toLocaleString()} — Descuento: -${descuentoGremioCalculado.toLocaleString()}
                      </div>
                    )}
                    <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#8b5cf6' }}>
                      TOTAL REMITO: ${totalFinal().toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={finalizarVenta}
                    style={{ width: '100%', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '18px', borderRadius: '15px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✅ GENERAR REMITO Y COMPROBANTE MAYORISTA
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RESUMEN LATERAL */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: '20px', width: isMobile ? '100%' : '360px' }}>
            {ticketFinal ? (
              <div style={cardStyle}>
                <h4 style={{ color: theme.text, marginBottom: '10px', marginTop: 0 }}>Último Remito Emitido</h4>
                <p style={{ color: theme.subtext, fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Total neto: <strong style={{ color: '#8b5cf6' }}>${ticketFinal.total.toLocaleString()}</strong><br />
                  Condición: <strong>{ticketFinal.metodo_pago}</strong><br />
                  Titular: <strong>{ticketFinal.cliente_nombre}</strong>
                </p>
                <button
                  onClick={() => imprimirTicketVenta(ticketFinal)}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#334155', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🖨️ RE-IMPRIMIR REMITO
                </button>
              </div>
            ) : null
            }
          </div>
        </div>
      )}

      {/* Modal de vista ampliada */}
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
                Valor unitario en cotización actual: <strong style={{ color: '#8b5cf6' }}>${Math.round(imagenZoom.precio_venta).toLocaleString()}</strong>
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