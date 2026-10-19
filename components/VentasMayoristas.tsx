"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../app/supabase'; 
import { useToast } from './ui/Avisos';
import { StepperCantidad, AjustePorcentual, armarHTMLTicket, type TonosPos } from './ui/PosComunes';

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

  // Paleta del punto de venta: la misma que usa el minorista, para que las dos
  // pantallas se vean idénticas (cada una con su lógica).
  const tonoPos: TonosPos = {
    fondo: theme.innerBox, borde: theme.border, texto: theme.text,
    subtexto: theme.subtext, acento: '#8b5cf6'
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

  // Edición manual del nombre de una línea del carrito (opcional: si no se toca,
  // manda el producto con su variedad).
  const [editandoTitulo, setEditandoTitulo] = useState<string | null>(null);
  const [borradorTitulo, setBorradorTitulo] = useState('');

  // Lo que se muestra en el carrito y se imprime en el remito.
  const tituloDe = (item: any) =>
    item.titulo_manual || `${item.nombre || ''}${item.variedad_nombre ? ` · ${item.variedad_nombre}` : ''}`;

  const variedadesDeItem = (item: any) => obtenerVariedades(stock.find(s => s.id === item.id));

  const confirmarTitulo = (clave: string) => {
    const limpio = borradorTitulo.trim();
    setCarrito(prev => prev.map(item =>
      claveCarrito(item) === clave ? { ...item, titulo_manual: limpio && limpio !== tituloDe(item) ? limpio : null } : item
    ));
    setEditandoTitulo(null);
    setBorradorTitulo('');
  };

  // Elegir (o sacar) la variedad ya dentro del carrito: cambia el precio si la
  // línea no fue editada a mano, y es lo que termina imprimiéndose.
  const cambiarVariedadEnCarrito = (clave: string, nuevaVariedadId: string) => {
    setCarrito(prev => {
      const destino = prev.find(item => claveCarrito(item) === clave);
      if (!destino) return prev;

      const itemStock = stock.find(s => s.id === destino.id);
      const variedad = obtenerVariedades(itemStock)
        .find((v: any) => String(v.id) === String(nuevaVariedadId)) || null;

      const actualizado = {
        ...destino,
        variedad_id: variedad?.id ?? null,
        variedad_nombre: variedad?.nombre ?? null,
        imagen: variedad?.imagen_url || itemStock?.imagen_url || destino.imagen,
        precio_original_mayorista: precioDe(itemStock, variedad, 'precio_mayorista') || precioDe(itemStock, variedad, 'precio_costo')
      };

      // Si ya existía otra línea con esa misma variedad se fusionan (la clave
      // del renglón depende del producto + variedad).
      const claveNueva = claveCarrito(actualizado);
      const repetido = prev.find(item => item !== destino && claveCarrito(item) === claveNueva);
      if (repetido) {
        const resto = prev.filter(item => item !== destino && item !== repetido);
        return [...resto, { ...repetido, unidades: repetido.unidades + actualizado.unidades }];
      }
      return prev.map(item => item === destino ? actualizado : item);
    });
  };

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

  // Historial de esta pantalla: los remitos con cuenta de cliente y los que se
  // cobraron sin cliente (quedan como Consumidor Final). Las ventas minoristas
  // quedan afuera por su cliente_nombre de mostrador.
  const historialMayoristaFiltrado = useMemo(() => {
    return ventas.filter((v: any) =>
      (v.cliente_id !== null && v.cliente_id !== undefined && v.cliente_id !== '') ||
      (v.cliente_nombre && v.cliente_nombre !== 'Venta Minorista Mostrador')
    );
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
    // La variedad ya no es obligatoria: si no se elige, el renglón entra con el
    // nombre por defecto del producto y se puede acomodar (nombre o variedad)
    // desde el carrito. Solo define el precio y lo que se imprime.

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

  // Cantidad de un renglón: llega desde el stepper, que acepta tanto los botones
  // −/+ como la escritura directa (hasta 4 dígitos).
  const manejarCambioUnidades = (clave: string, unidades: number) => {
    const n = Math.min(9999, Math.max(1, Math.round(unidades) || 1));
    setCarrito(prevCarrito => prevCarrito.map(item => claveCarrito(item) === clave ? { ...item, unidades: n } : item));
  };

  const eliminarLinea = (clave: string) => {
    setCarrito(prevCarrito => prevCarrito.filter(c => claveCarrito(c) !== clave));
  };

  const handleSumarManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (sugerencias.length > 0) ejecutarAgregadoDirecto(sugerencias[0], cantidadSeleccionada);
  };

  // Comprobante: encabezado DISTRIBUIDORA INDIA con día y hora, medio de pago,
  // cliente si corresponde, lista de productos con cantidad e importe y al
  // final el total. Si quedó en Cuenta Corriente agrega el saldo. Sirve para
  // emitir y para la reimpresión del historial.
  const imprimirTicketVenta = (datos: any) => {
    const windowUrl = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!windowUrl) return;

    const cliente = datos.cliente_nombre || 'Consumidor Final';
    const cuenta = listaClientes.find(c => String(c.id) === String(datos.cliente_id));
    const saldo = datos.saldo_cc !== undefined && datos.saldo_cc !== null
      ? Number(datos.saldo_cc)
      : Number(cuenta?.saldo_cc || 0);

    windowUrl.document.write(armarHTMLTicket({
      fecha: datos.fecha,
      metodoPago: datos.metodo_pago,
      cliente,
      items: (Array.isArray(datos.items) ? datos.items : []).map((i: any) => ({
        unidades: i.unidades,
        nombre: tituloDe(i),
        importe: i.unidades * (i.precio_venta || i.precio_original_mayorista || 0)
      })),
      total: datos.total,
      pie: datos.metodo_pago === 'Cuenta Corriente'
        ? `CUENTA CORRIENTE · SALDO: $${saldo.toLocaleString('es-AR')}`
        : null
    }));
    windowUrl.document.close();
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    // El cliente es opcional (si no hay, sale como Consumidor Final), salvo en
    // Cuenta Corriente: no se puede cargar un saldo sin cuenta titular.
    if (metodoPago === 'Cuenta Corriente' && !clienteSeleccionado) {
      return toast.avisar("Para cobrar en Cuenta Corriente hay que elegir la cuenta de un cliente.", 'alerta');
    }

    try {
      const finalTotal = totalFinal();
      const clienteNombreStr = infoClienteActivo ? infoClienteActivo.nombre : 'Consumidor Final';
      let saldoEmitido: number | undefined;

      if (metodoPago === 'Cuenta Corriente' && infoClienteActivo) {
        const saldoPrevio = Number(infoClienteActivo.saldo_cc || 0);
        saldoEmitido = saldoPrevio + finalTotal;
        await supabase.from('clientes').update({ saldo_cc: saldoEmitido }).eq('id', Number(clienteSeleccionado));
        // Se refresca en memoria: así la reimpresión muestra el saldo vigente.
        setListaClientes(prev => prev.map(c =>
          String(c.id) === String(clienteSeleccionado) ? { ...c, saldo_cc: saldoEmitido } : c
        ));
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
        cliente_id: clienteSeleccionado ? Number(clienteSeleccionado) : null, 
        cliente_nombre: clienteNombreStr, 
        estado: 'completada' 
      };

      const { error } = await supabase.from('ventas').insert([nuevaVenta]);
      if (error) throw error;

      setVentas([nuevaVenta, ...ventas]);
      setTicketFinal(nuevaVenta);
      // El saldo va solo al papel (nuevaVenta ya está insertada sin columnas de más).
      imprimirTicketVenta({ ...nuevaVenta, saldo_cc: saldoEmitido });
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
        <p style={{ color: theme.subtext, margin: 0, fontSize: '0.85rem' }}>Remitos a clientes mayoristas con tarifa y cuenta corriente</p>
        <button
          onClick={() => setVerHistorial(!verHistorial)}
          style={{ backgroundColor: verHistorial ? '#ef4444' : '#8b5cf6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s', width: isMobile ? '100%' : 'auto', minHeight: 42 }}
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
                      <span style={{ color: theme.text, fontWeight: 'bold', fontSize: '1.05rem' }}>👤 {v.cliente_nombre || 'Consumidor Final'}</span>
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
                      style={{ ...inputStyle, paddingLeft: '42px' }}
                    />
                    <span aria-hidden style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.subtext, pointerEvents: 'none', fontSize: '0.95rem' }}>🔍</span>

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

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <StepperCantidad
                      valor={cantidadSeleccionada}
                      onCambio={setCantidadSeleccionada}
                      tono={tonoPos}
                      ancho={68}
                      alto={46}
                      etiqueta="Cantidad a agregar"
                    />
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '12px',
                        padding: '0 24px', height: 46, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem',
                        letterSpacing: '0.4px', transition: 'filter .15s ease', whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e: any) => { e.currentTarget.style.filter = 'brightness(1.12)'; }}
                      onMouseLeave={(e: any) => { e.currentTarget.style.filter = 'none'; }}
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
              
              {carritoMayoristaConPrecios.map(item => {
                const clave = claveCarrito(item);
                const variedades = variedadesDeItem(item);
                return (
                <div
                   key={clave}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 0', borderBottom: `1px solid ${theme.border}`,
                    color: theme.text, gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap'
                  }}
                >
                  <div 
                    onClick={() => setImagenZoom(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer',
                      // En el celular el renglón ocupa todo el ancho y los controles
                      // de la derecha pasan a la línea de abajo: si no, el stepper
                      // se montaba sobre la variedad y el título se colapsaba.
                      flex: isMobile ? '1 1 100%' : '1 1 0'
                    }}
                  >
                    <Miniatura src={item.imagen} alt={tituloDe(item)} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* NOMBRE DEL RENGLÓN: por defecto producto · variedad y se
                          puede renombrar a mano (opcional; manda en el ticket). */}
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}
                      >
                        {editandoTitulo === clave ? (
                          <input
                            autoFocus
                            value={borradorTitulo}
                            onChange={e => setBorradorTitulo(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') confirmarTitulo(clave);
                              if (e.key === 'Escape') { setEditandoTitulo(null); setBorradorTitulo(''); }
                            }}
                            onBlur={() => confirmarTitulo(clave)}
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '0.95rem', fontWeight: 700 }}
                          />
                        ) : (
                          <>
                            <span
                              title={tituloDe(item)}
                              style={{
                                fontWeight: 700, fontSize: '1.02rem', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0
                              }}
                            >
                              {tituloDe(item)}
                            </span>
                            <button
                              type="button"
                              title="Renombrar este renglón (opcional)"
                              aria-label="Renombrar este renglón"
                              onClick={() => { setEditandoTitulo(clave); setBorradorTitulo(tituloDe(item)); }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                                padding: '2px 4px', borderRadius: '6px', flexShrink: 0, opacity: 0.75
                              }}
                              onMouseEnter={(e: any) => { e.currentTarget.style.opacity = 1; }}
                              onMouseLeave={(e: any) => { e.currentTarget.style.opacity = 0.75; }}
                            >✏️</button>
                          </>
                        )}
                      </div>

                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                      >
                        {variedades.length > 0 && (
                          <select
                            value={item.variedad_id || ''}
                            onChange={e => cambiarVariedadEnCarrito(clave, e.target.value)}
                            title="Variedad: define el precio y lo que se imprime"
                            style={{
                              ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: '0.78rem',
                              backgroundColor: theme.card, maxWidth: '170px'
                            }}
                          >
                            <option value="">Sin variedad</option>
                            {variedades.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                          </select>
                        )}
                        <span>Precio:</span>
                        <input
                          type="number"
                          value={Math.round(item.precio_venta)}
                          onChange={e => manejarCambioPrecioInput(clave, e.target.value)}
                          style={{
                            ...inputStyle, width: '95px', padding: '4px 8px',
                            display: 'inline-block', fontFamily: 'monospace', fontWeight: 'bold',
                            color: item.precioModificado ? '#10b981' : '#8b5cf6'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', gap: '8px', flexShrink: 0,
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: isMobile ? 'center' : 'flex-end',
                    justifyContent: isMobile ? 'space-between' : 'flex-end',
                    width: isMobile ? '100%' : 'auto'
                  }}>
                    <StepperCantidad
                      valor={item.unidades}
                      onCambio={n => manejarCambioUnidades(clave, n)}
                      onLlegarAlMinimo={() => eliminarLinea(clave)}
                      tono={tonoPos}
                      ancho={58}
                      alto={40}
                      etiqueta={`Cantidad de ${item.nombre}`}
                    />
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#8b5cf6' }}>
                      ${(item.precio_venta * item.unidades).toLocaleString('es-AR')}
                    </strong>
                    <button
                      type="button"
                      onClick={() => eliminarLinea(clave)}
                      title="Quitar del carrito"
                      aria-label="Quitar del carrito"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.05rem', padding: '4px' }}
                    >🗑️</button>
                  </div>
                </div>
                );
              })}

            </div>

          </div>

          {/* RESUMEN LATERAL: totales, cobro y último remito. Sticky en
              escritorio; en el celular queda debajo del carrito. */}
          <div style={{
            position: isMobile ? 'static' : 'sticky', top: '20px',
            width: isMobile ? '100%' : '360px', display: 'flex',
            flexDirection: 'column', gap: '20px', boxSizing: 'border-box'
          }}>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 15px', color: theme.text, fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.4px' }}>
                💳 RESUMEN Y COBRO
              </h3>

              <AjustePorcentual
                valor={porcentajeAjuste}
                onValor={setPorcentajeAjuste}
                onAplicar={aplicarAjustePorcentualMasivo}
                tono={tonoPos}
                etiqueta="⚡ AJUSTE PORCENTUAL SOBRE LA TARIFA MAYORISTA"
                placeholder="Ej: 12 equivale a 12%"
              />

              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>MÉTODO DE PAGO</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Tarjeta</option>
                  <option>Cuenta Corriente</option>
                </select>
              </div>

              {/* En Cuenta Corriente no se muestra el descuento de la cuenta:
                  se carga el total tal como se ve, con lo que ya tiene el
                  cliente en su cuenta corriente. */}
              {metodoPago !== 'Cuenta Corriente' && (
                <div style={{ marginTop: '14px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 700, display: 'block', marginBottom: '6px' }}>DESCUENTO ASIGNADO (GREMIO)</label>
                  <input
                    type="text"
                    value={`$${descuentoGremioCalculado.toLocaleString()} (-${infoClienteActivo ? infoClienteActivo.descuento_especial : 0}%)`}
                    style={{ ...inputStyle, border: '1px solid #8b5cf6', fontFamily: 'monospace', fontWeight: 'bold' }}
                    disabled
                  />
                </div>
              )}

              <div style={{ marginTop: '16px', borderTop: `1px dashed ${theme.border}`, paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                  <label style={{ fontSize: '0.72rem', color: theme.subtext, fontWeight: 700 }}>
                    👤 CUENTA DE CLIENTE <span style={{ color: '#8b5cf6' }}>(opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreandoCliente(!creandoCliente)}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}
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
                  <>
                    <select
                      value={clienteSeleccionado}
                      onChange={e => setClienteSeleccionado(e.target.value)}
                      style={{ ...inputStyle, border: metodoPago === 'Cuenta Corriente' && !clienteSeleccionado ? '2px solid #ef4444' : `1px solid ${theme.border}` }}
                    >
                      <option value="">-- Sin cliente (Consumidor Final) --</option>
                      {listaClientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {!clienteSeleccionado && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: theme.subtext }}>
                        {metodoPago === 'Cuenta Corriente'
                          ? 'Elegí la cuenta que se debita en Cuenta Corriente.'
                          : 'Si no elegís ninguna, la venta sale como Consumidor Final.'}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: '18px', borderTop: `1px dashed ${theme.border}`, paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: theme.subtext, marginBottom: '6px' }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: 'monospace' }}>${subtotalCarrito().toLocaleString()}</span>
                </div>
                {descuentoGremioCalculado > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#10b981', marginBottom: '6px' }}>
                    <span>Descuento gremio</span>
                    <span style={{ fontFamily: 'monospace' }}>−${descuentoGremioCalculado.toLocaleString()}</span>
                  </div>
                )}
                <div style={{
                  backgroundColor: theme.bg, padding: '14px', borderRadius: '14px',
                  border: `1px solid ${theme.border}`, textAlign: 'right', marginTop: '10px'
                }}>
                  <div style={{ fontSize: '0.7rem', color: theme.subtext, fontWeight: 700, letterSpacing: '0.6px' }}>TOTAL REMITO</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#8b5cf6', fontFamily: 'monospace', lineHeight: 1.15 }}>
                    ${totalFinal().toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={finalizarVenta}
                  disabled={carrito.length === 0}
                  style={{
                    width: '100%', marginTop: '15px', backgroundColor: '#8b5cf6', color: '#fff',
                    border: 'none', padding: '17px', borderRadius: '14px', fontWeight: 900,
                    fontSize: '1.05rem', cursor: carrito.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: carrito.length === 0 ? 0.45 : 1, transition: 'filter .15s ease',
                    minHeight: 54
                  }}
                  onMouseEnter={(e: any) => { if (carrito.length > 0) e.currentTarget.style.filter = 'brightness(1.12)'; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.filter = 'none'; }}
                >
                  ✅ GENERAR REMITO Y COMPROBANTE
                </button>
              </div>
            </div>

            {ticketFinal ? (
              <div style={cardStyle}>
                <h4 style={{ color: theme.text, marginBottom: '10px', marginTop: 0, fontSize: '0.9rem' }}>Último Remito Emitido</h4>
                <p style={{ color: theme.subtext, fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Total neto: <strong style={{ color: '#8b5cf6' }}>${ticketFinal.total.toLocaleString()}</strong><br />
                  Condición: <strong>{ticketFinal.metodo_pago}</strong><br />
                  Titular: <strong>{ticketFinal.cliente_nombre || 'Consumidor Final'}</strong>
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