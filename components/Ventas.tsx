"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../app/supabase'; 
import { useToast } from './ui/Avisos';
import { StepperCantidad, AjustePorcentual, armarHTMLTicket, type TonosPos } from './ui/PosComunes';

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

  // Beep corto para feedback al escanear (Web Audio, sin archivos externos).
  const beep = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cantidadSeleccionada, setCantidadSeleccionada] = useState(1);
  const [variedadElegidaPorProducto, setVariedadElegidaPorProducto] = useState<Record<string, string>>({});
  const [ticketFinal, setTicketFinal] = useState<any>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [ventaEditando, setVentaEditando] = useState<any>(null);
  
  const [descuento, setDescuento] = useState(0);
  const [descuentoEfectivo, setDescuentoEfectivo] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [montoEntregado, setMontoEntregado] = useState('');

  const [listaSeleccionada, setListaSeleccionada] = useState<'precio_minorista' | 'precio_promo'>('precio_minorista');

  // Control de zoom para el artículo seleccionado del carrito
  const [imagenZoom, setImagenZoom] = useState<any>(null);

  // Control del porcentaje masivo para el carrito
  const [porcentajeAjuste, setPorcentajeAjuste] = useState<string>('');

  // --- Venta rápida por monto (borrador, no afecta la caja hasta confirmarse) ---
  const [ventaRapidaAbierta, setVentaRapidaAbierta] = useState(false);
  const [montoRapido, setMontoRapido] = useState('');
  const [descRapido, setDescRapido] = useState('');
  const [metodoRapido, setMetodoRapido] = useState('Efectivo');
  const [borradores, setBorradores] = useState<any[]>([]);
  const [borradorActivo, setBorradorActivo] = useState<number | null>(null);
  const [avisoAgregado, setAvisoAgregado] = useState<string | null>(null);

  // --- Persistencia del carrito en localStorage ---
  const CARRITO_KEY = 'ventas_minorista_carrito';
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CARRITO_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) setCarrito(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (carrito.length > 0) localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
    else localStorage.removeItem(CARRITO_KEY);
  }, [carrito]);

  // Limpiar carrito al completar venta (ya lo hace setCarrito([]) en finalizarVenta)
  const limpiarCarritoPersistente = () => {
    setCarrito([]);
    localStorage.removeItem(CARRITO_KEY);
  };

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

  // Mantener el foco en el buscador para que la pistola pueda seguir escaneando.
  useEffect(() => {
    if (buscadorRef.current && !verHistorial) buscadorRef.current.focus();
  }, [verHistorial, carrito.length]);

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

  // Paleta del punto de venta: la misma que usa el mayorista, para que las dos
  // pantallas se vean idénticas (cada una con su lógica).
  const tonoPos: TonosPos = {
    fondo: theme.innerBox, borde: theme.border, texto: theme.text,
    subtexto: theme.subtext, acento: '#10b981'
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

  // Edición manual del nombre de una línea del carrito (opcional: si no se toca,
  // manda el producto con su variedad).
  const [editandoTitulo, setEditandoTitulo] = useState<string | null>(null);
  const [borradorTitulo, setBorradorTitulo] = useState('');

  // Lo que se muestra en el carrito y se imprime en el ticket.
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
        precio_original_minorista: precioDe(itemStock, variedad, 'precio_minorista')
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
  const totalConDescuento = () => Math.max(0, subtotalCarrito() - descuento - descuentoEfectivo);

  const aplicarAjustePorcentualMasivo = (tipo: 'recargo' | 'descuento') => {
    const porcentaje = Number(porcentajeAjuste);
    if (isNaN(porcentaje) || porcentaje <= 0) {
      return toast.avisar("Por favor ingresá un número de porcentaje válido y mayor a 0.", 'alerta');
    }

    const factor = tipo === 'recargo' ? 1 + porcentaje / 100 : 1 - porcentaje / 100;

    const nuevoCarritoAjustado = carritoConPreciosVivos.map(item => {
      return {
        ...item,
        precio_venta: Math.round((item.precio_venta || 0) * factor),
        precioModificado: true 
      };
    });

    setCarrito(nuevoCarritoAjustado);
    setPorcentajeAjuste(''); 
  };

  // Historial del mostrador: ventas sin cuenta de cliente, excepto las que se
  // cobraron en el POS mayorista sin cliente (salen como Consumidor Final).
  const historialMinoristaFiltrado = useMemo(() => {
    return ventas.filter((v: any) => {
      if (v.estado === 'borrador') return false;
      const sinCliente = v.cliente_id === null || v.cliente_id === undefined || v.cliente_id === '';
      return sinCliente && v.cliente_nombre !== 'Consumidor Final';
    });
  }, [ventas]);

  const totalPaginasHistorial = Math.ceil(historialMinoristaFiltrado.length / itemsPorPaginaHistorial);
  const historialPaginado = useMemo(() => {
    const inicio = (paginaHistorial - 1) * itemsPorPaginaHistorial;
    return historialMinoristaFiltrado.slice(inicio, inicio + itemsPorPaginaHistorial);
  }, [historialMinoristaFiltrado, paginaHistorial]);

  useEffect(() => {
    const term = busqueda.trim();
    if (!term) { setSugerencias([]); setMostrarSugerencias(false); return; }

    const buscarEnBaseDeDatos = async () => {

      // 1) Coincidencia local por código exacto (producto o variedad): instantánea
      //    para la pistola, sin esperar el roundtrip a Supabase.
      const termLower = term.toLowerCase();
      const local = stock.find((s: any) =>
        (s.codigo && String(s.codigo).toLowerCase() === termLower) ||
        (Array.isArray(s.variedades) && s.variedades.some((v: any) => v.codigo && String(v.codigo).toLowerCase() === termLower))
      );
      if (local) {
        const variedad = Array.isArray(local.variedades)
          ? local.variedades.find((v: any) => v.codigo && String(v.codigo).toLowerCase() === termLower) || null
          : null;
        ejecutarAgregadoDirecto(local, cantidadSeleccionada, variedad?.id);
        return;
      }

      // 2) Búsqueda por nombre/código en Supabase (para tipeo manual).
      const { data } = await supabase
        .from('stock')
        .select('id, nombre, codigo, precio_minorista, precio_costo, precio_promo, imagen_url, variedades')
        .or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%`)
        .limit(10);

      if (data) {
        setSugerencias(data);
        setMostrarSugerencias(true);
        const coincidenciaExacta = data.find(
          (item: any) => item.codigo && String(item.codigo).toLowerCase() === termLower
        );
        if (coincidenciaExacta) {
          // Ahora se agrega igual aunque tenga variedades (se usa la primera).
          ejecutarAgregadoDirecto(coincidenciaExacta, cantidadSeleccionada);
        }
      }
    };
    const esCodigoExacto = stock.some((s: any) =>
      (s.codigo && String(s.codigo).toLowerCase() === term.toLowerCase()) ||
      (Array.isArray(s.variedades) && s.variedades.some((v: any) => v.codigo && String(v.codigo).toLowerCase() === term.toLowerCase()))
    );
    const delay = esCodigoExacto ? 0 : 200;
    const delayDebounce = setTimeout(() => { buscarEnBaseDeDatos(); }, delay);
    return () => clearTimeout(delayDebounce);
  }, [busqueda, stock, cantidadSeleccionada]);

  const ejecutarAgregadoDirecto = (producto: any, cantidad: number, variedadId?: string) => {
    const variedades = obtenerVariedades(producto);
    // Si no se eligió variedad (pistola o Enter) y el producto tiene variedades,
    // se usa la primera para que el precio no quede en 0; se puede cambiar en el carrito.
    const idElegido = variedadId || variedadElegidaPorProducto[producto.id] || (variedades.length > 0 ? variedades[0].id : '');
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
      precio_original_minorista: precioDe(producto, variedadObj, 'precio_minorista'),
      precio_costo: precioDe(producto, variedadObj, 'precio_costo'),
      unidades: cantidad,
      precioModificado: false
    };
    const clave = claveCarrito(nuevoItem);

    setCarrito(prevCarrito => {
      const existe = prevCarrito.find(item => claveCarrito(item) === clave);
      if (existe) {
        return prevCarrito.map(item => claveCarrito(item) === clave ? { ...item, unidades: item.unidades + cantidad } : item);
      }
      return [nuevoItem, ...prevCarrito];
    });
    if (variedadObj) setVariedadElegidaPorProducto(prev => ({ ...prev, [producto.id]: variedadObj.id }));
    setBusqueda('');
    setSugerencias([]);
    setMostrarSugerencias(false);
    setCantidadSeleccionada(1);
    beep();
    setAvisoAgregado(producto.nombre);
    setTimeout(() => setAvisoAgregado(null), 1200);
    setTimeout(() => buscadorRef.current?.focus(), 0);
  };

  // Enter o el botón AÑADIR agregan la primera coincidencia (mismo camino que
  // el clic en el resultado), con la cantidad que se esté usando.
  const handleSumarManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (sugerencias.length > 0) ejecutarAgregadoDirecto(sugerencias[0], cantidadSeleccionada);
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

  // Comprobante del mostrador: encabezado DISTRIBUIDORA INDIA con día y hora,
  // medio de pago, lista de productos con cantidad e importe y al final el
  // total. Sin subtotales ni descuentos. Sirve para emitir y para reimprimir.
  const imprimirTicketVenta = (datos: any) => {
    const windowUrl = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!windowUrl) return;
    const items = (Array.isArray(datos.items) ? datos.items : []).map((i: any) => {
      const precioUnitario = i.precio_venta || i.precio_original_minorista || 0;
      return {
        unidades: i.unidades,
        nombre: tituloDe(i),
        precioUnitario,
        importe: i.unidades * precioUnitario
      };
    });
    const subtotal = items.reduce((acc: number, i: any) => acc + i.importe, 0);
    const total = datos.total;
    const vuelto = datos.vuelto || (datos.monto_entregado && datos.monto_entregado > total ? datos.monto_entregado - total : 0);
    const metodoPago = datos.metodo_pago;
    const fechaSolo = String(datos.fecha || '').split(',')[0].trim() || new Date().toLocaleDateString('es-AR');
    const clienteStr = datos.cliente_nombre && !/mostrador/i.test(datos.cliente_nombre)
      ? datos.cliente_nombre
      : 'Mostrador';
    
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { margin: 3mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 2px; margin: 0; font-size: 15px; font-weight: bold; color: #000; }
            .text-center { text-align: center; }
            h3 { margin: 0 0 2px; font-size: 20px; letter-spacing: 1px; }
            .meta-row { display: flex; justify-content: space-between; gap: 4px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin-top: 1px; }
            .meta-row span { white-space: nowrap; }
            .meta-row .cli { flex: 1 1 auto; min-width: 0; white-space: normal; text-align: center; padding: 0 2px; line-height: 1.15; }
            .divider { border-top: 1px dashed #000; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { padding: 0.5px 2px; vertical-align: top; }
            th { font-size: 15px; text-transform: uppercase; border-bottom: 1px solid #000; }
            td.nom { word-break: break-word; }
            td.pu, th.pu { text-align: right; white-space: nowrap; }
            td.cant, th.cant { text-align: center; white-space: nowrap; }
            td.tot, th.tot { text-align: right; white-space: nowrap; }
            .totales { font-size: 15px; }
            .total { font-size: 15px; font-weight: 900; margin-top: 2px; text-align: right; }
            .pie { margin-top: 6px; text-align: center; font-size: 12px; }
            .vuelto { color: #047857; font-size: 15px; font-weight: 900; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3>DISTRIBUIDORA INDIA</h3>
          </div>
          <div class="meta-row">
            <span>Fecha: ${fechaSolo}</span>
            <span class="cli">Cliente: ${clienteStr}</span>
            <span>Pago: ${metodoPago.toUpperCase()}</span>
          </div>
          <div class="divider"></div>
          <table>
            <colgroup>
              <col style="width:46%" /><col style="width:20%" /><col style="width:10%" /><col style="width:24%" />
            </colgroup>
            <thead>
              <tr>
                <th style="text-align:left">Producto</th>
                <th class="pu">P.Unit</th>
                <th class="cant">Cant</th>
                <th class="tot">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i: any) => `<tr><td class="nom">${i.nombre}</td><td class="pu">$${i.precioUnitario.toLocaleString('es-AR')}</td><td class="cant">${i.unidades}</td><td class="tot">$${i.importe.toLocaleString('es-AR')}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="totales">
            <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>$${subtotal.toLocaleString('es-AR')}</span></div>
            ${datos.descuento > 0 ? `<div style="display:flex;justify-content:space-between;color:#10b981"><span>Descuento</span><span>−$${Number(datos.descuento).toLocaleString('es-AR')}</span></div>` : ''}
            ${datos.descuento_efectivo > 0 ? `<div style="display:flex;justify-content:space-between;color:#f59e0b"><span>Desc. Efectivo</span><span>−$${Number(datos.descuento_efectivo).toLocaleString('es-AR')}</span></div>` : ''}
          </div>
          <div class="divider"></div>
          <div class="total">TOTAL: $${Number(total).toLocaleString('es-AR')}</div>
          ${metodoPago === 'Efectivo' && vuelto > 0 ? `
            <div class="divider"></div>
            <div style="display:flex;justify-content:space-between;font-size:15px"><span>Entregado</span><span>$${Number(datos.monto_entregado).toLocaleString('es-AR')}</span></div>
            <div class="vuelto">VUELTO: $${vuelto.toLocaleString('es-AR')}</div>
          ` : ''}
        </body>
        <script>window.onload = function() { window.print(); window.close(); };<\/script>
      </html>
    `;
    windowUrl.document.write(html);
    windowUrl.document.close();
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    try {
      const finalTotal = totalConDescuento();
      const idVenta = ventaEditando ? ventaEditando.id : Date.now();
      const nuevaVenta = {
        id: idVenta,
        fecha: ventaEditando ? ventaEditando.fecha : new Date().toLocaleString('es-AR'),
        items: carritoConPreciosVivos,
        subtotal: subtotalCarrito(),
        descuento,
        descuento_efectivo: descuentoEfectivo,
        monto_entregado: metodoPago === 'Efectivo' ? Number(montoEntregado) || null : null,
        total: finalTotal,
        metodo_pago: metodoPago,
        cliente_id: null,
        cliente_nombre: 'Venta Minorista Mostrador',
        estado: 'completada'
      };

      if (ventaEditando) {
        const { error } = await supabase.from('ventas').update(nuevaVenta).eq('id', ventaEditando.id);
        if (error) throw error;
        setVentas((prev: any[]) => prev.map(v => v.id === ventaEditando.id ? nuevaVenta : v));
      } else {
        const { error } = await supabase.from('ventas').insert([nuevaVenta]);
        if (error) throw error;
        setVentas([nuevaVenta, ...ventas]);
      }

      setTicketFinal(nuevaVenta);
      imprimirTicketVenta({ ...nuevaVenta, vuelto: metodoPago === 'Efectivo' && Number(montoEntregado) > finalTotal ? Number(montoEntregado) - finalTotal : 0 });
      limpiarCarritoPersistente();
      setDescuento(0);
      setDescuentoEfectivo(0);
      setMontoEntregado('');
      setMetodoPago('Efectivo');
      setListaSeleccionada('precio_minorista');
      if (ventaEditando) {
        toast.avisar('Venta actualizada', 'exito');
        setVentaEditando(null);
      }
    } catch (e: any) { toast.error("Error al registrar venta minorista: " + e.message); }
  };

  const iniciarEdicionVenta = (v: any) => {
    if (!v) return;
    const items = (Array.isArray(v.items) ? v.items : []).map((it: any) => ({
      id: it.id,
      nombre: it.nombre,
      variedad_id: it.variedad_id || null,
      variedad_nombre: it.variedad_nombre || null,
      imagen: it.imagen || null,
      precio_original_minorista: it.precio_original_minorista || it.precio_venta || 0,
      precio_venta: it.precio_venta || it.precio_original_minorista || 0,
      unidades: it.unidades || 1,
      precioModificado: true,
      titulo_manual: it.titulo_manual || null
    }));
    setCarrito(items);
    setDescuento(Number(v.descuento) || 0);
    setDescuentoEfectivo(Number(v.descuento_efectivo) || 0);
    setMetodoPago(v.metodo_pago || 'Efectivo');
    setMontoEntregado(v.monto_entregado ? String(v.monto_entregado) : '');
    setVentaEditando(v);
    setVerHistorial(false);
    // persist
    try { localStorage.setItem('ventas_minorista_carrito', JSON.stringify(items)); } catch {}
    toast.avisar('Editando venta #' + v.id, 'info');
  };

  const cancelarEdicionVenta = () => {
    setCarrito([]);
    setVentaEditando(null);
    setDescuento(0);
    setDescuentoEfectivo(0);
    setMontoEntregado('');
    setMetodoPago('Efectivo');
    try { localStorage.removeItem('ventas_minorista_carrito'); } catch {}
    toast.avisar('Edición cancelada', 'info');
  };

  // --- Borradores de venta rápida ---
  const cargarBorradores = async () => {
    const { data } = await supabase.from('ventas').select('*').eq('estado', 'borrador');
    if (data) setBorradores(data.filter((v: any) => {
      const fecha = v.created_at ? new Date(v.created_at) : (v.id ? new Date(Number(v.id)) : null);
      if (!fecha || isNaN(fecha.getTime())) return false;
      const hoy = new Date();
      return fecha.getDate() === hoy.getDate() && fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
    }));
  };

  useEffect(() => { cargarBorradores(); }, []);

  const guardarBorrador = async () => {
    const monto = Number(montoRapido);
    if (!Number.isFinite(monto) || monto <= 0) { toast.avisar('Ingresá un monto válido', 'alerta'); return; }
    const items = carrito.length > 0 ? carritoConPreciosVivos : [{ nombre: descRapido.trim() || 'Venta rápida', unidades: 1, precio_venta: monto, precio_costo: 0 }];
    const total = carrito.length > 0 ? totalConDescuento() : monto;
    const nueva = {
      id: Date.now(),
      fecha: new Date().toLocaleString('es-AR'),
      items,
      subtotal: total,
      descuento,
      total,
      metodo_pago: metodoRapido,
      cliente_id: null,
      cliente_nombre: 'BORRADOR VENTA RÁPIDA',
      estado: 'borrador'
    };
    const { error } = await supabase.from('ventas').insert([nueva]);
    if (error) { toast.error('No se pudo guardar el borrador: ' + error.message); return; }
    setVentas([nueva, ...ventas]);
    setBorradores([nueva, ...borradores]);
    setCarrito([]); setDescuento(0); setMetodoPago('Efectivo'); setListaSeleccionada('precio_minorista');
    setVentaRapidaAbierta(false); setMontoRapido(''); setDescRapido('');
    toast.avisar('Borrador guardado. Lo completás cuando quieras.', 'exito');
  };

  const cargarBorrador = (b: any) => {
    setCarrito((Array.isArray(b.items) ? b.items : []).map((it: any) => ({
      id: it.id || 0, nombre: it.nombre || 'Venta rápida', variedad_id: it.variedad_id || null,
      variedad_nombre: it.variedad_nombre || null, imagen: it.imagen || null,
      precio_original_minorista: it.precio_venta || 0, unidades: it.unidades || 1,
      precioModificado: true, titulo_manual: it.titulo_manual || null
    })));
    setMetodoPago(b.metodo_pago || 'Efectivo');
    setDescuento(Number(b.descuento) || 0);
    setBorradorActivo(b.id);
    toast.avisar('Borrador cargado en el carrito. Completalo y confirmá.', 'exito');
  };

  const completarBorrador = async () => {
    if (borradorActivo == null) return;
    if (carrito.length === 0) { toast.avisar('El carrito está vacío', 'alerta'); return; }
    try {
      const finalTotal = totalConDescuento();
      const { error } = await supabase.from('ventas').update({
        items: carritoConPreciosVivos, subtotal: subtotalCarrito(), descuento,
        total: finalTotal, metodo_pago: metodoPago, estado: 'completada'
      }).eq('id', borradorActivo);
      if (error) throw error;
      const nueva = { id: borradorActivo, fecha: new Date().toLocaleString('es-AR'), items: carritoConPreciosVivos, subtotal: subtotalCarrito(), descuento, total: finalTotal, metodo_pago: metodoPago, cliente_id: null, cliente_nombre: 'Venta Minorista Mostrador', estado: 'completada' };
      setVentas([nueva, ...ventas.filter((v: any) => v.id !== borradorActivo)]);
      setBorradores(borradores.filter((b: any) => b.id !== borradorActivo));
      setTicketFinal(nueva);
      imprimirTicketVenta(nueva);
      setCarrito([]); setDescuento(0); setMetodoPago('Efectivo'); setListaSeleccionada('precio_minorista'); setBorradorActivo(null);
      toast.avisar('Venta confirmada', 'exito');
    } catch (e: any) { toast.error('Error al confirmar: ' + e.message); }
  };

  const eliminarBorrador = async (id: number) => {
    const ok = await confirmar({ titulo: '¿Eliminar este borrador?', mensaje: 'Se descarta el monto guardado.' });
    if (!ok) return;
    await supabase.from('ventas').delete().eq('id', id);
    setBorradores(borradores.filter((b: any) => b.id !== id));
    if (borradorActivo === id) { setBorradorActivo(null); setCarrito([]); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ color: theme.subtext, margin: 0, fontSize: '0.85rem' }}>Cobro en mostrador con búsqueda por nombre o código de barras</p>
        <button
          onClick={() => setVerHistorial(!verHistorial)}
          style={{ backgroundColor: verHistorial ? '#ef4444' : '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s', width: isMobile ? '100%' : 'auto', minHeight: 42 }}
        >
          {verHistorial ? '✕ VOLVER AL PANEL VIVO' : '📜 VER HISTORIAL'}
        </button>
        <button
          onClick={() => setVentaRapidaAbierta(true)}
          style={{ backgroundColor: '#f59e0b', color: '#1f2937', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s', width: isMobile ? '100%' : 'auto', minHeight: 42 }}
        >
          ⚡ VENTA RÁPIDA
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
                    <button
                      onClick={() => iniciarEdicionVenta(v)}
                      style={{ backgroundColor: theme.card, color: '#f59e0b', border: '1px solid #f59e0b', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', marginLeft: '8px' }}
                    >
                      ✏️ EDITAR
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
              <form
                onSubmit={handleSumarManual}
                style={{
                  display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center'
                }}
              >
                <div style={{ flex: 1, position: 'relative', width: '100%' }}>
                  <input
                    ref={buscadorRef}
                    type="text"
                    placeholder="Escanee o busque producto..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '42px' }}
                  />
                  <span aria-hidden style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: theme.subtext, pointerEvents: 'none', fontSize: '0.95rem' }}>🔍</span>
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
                      backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '12px',
                      padding: '0 24px', height: 46, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem',
                      letterSpacing: '0.4px', transition: 'filter .15s ease', whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.filter = 'brightness(1.12)'; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.filter = 'none'; }}
                  >
                    AÑADIR
                  </button>
                </div>
              </form>

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
                               width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                               backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               border: `1px solid ${theme.border}`
                             }}>
                               {s.imagen_url
                                 ? <img src={s.imagen_url} alt={s.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                 : <span style={{ fontSize: '1.8rem' }}>📦</span>
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
                                   {variedades.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}{v.codigo ? ` · ${v.codigo}` : ''}</option>)}
                                 </select>
                               )}
                                {promoDe(s, variedad) && (
                                  <span style={{
                                    display: 'inline-block', marginTop: '6px',
                                    backgroundColor: '#f59e0b', color: '#1f2937',
                                    fontSize: '0.85rem', fontWeight: 900, padding: '4px 10px',
                                    borderRadius: '8px', letterSpacing: '0.3px',
                                    boxShadow: '0 2px 6px rgba(245,158,11,0.35)'
                                  }}>
                                    🎁 {promoDe(s, variedad)}
                                  </span>
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

            {/* BORRADORES DE VENTA RÁPIDA */}
            {borradores.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ color: '#f59e0b', fontSize: '0.9rem', marginTop: 0 }}>⚡ BORRADORES PENDIENTES ({borradores.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {borradores.map((b: any) => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.innerBox, gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: theme.text, fontWeight: 700, fontSize: '0.9rem' }}>${Number(b.total || 0).toLocaleString('es-AR')}</div>
                        <div style={{ color: theme.subtext, fontSize: '0.75rem' }}>{b.fecha} • {Array.isArray(b.items) ? b.items.length : 0} línea(s)</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => cargarBorrador(b)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>CARGAR</button>
                        <button onClick={() => eliminarBorrador(b.id)} style={{ backgroundColor: 'transparent', color: '#ef4444', border: `1px solid #ef4444`, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                {borradorActivo != null && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={completarBorrador} style={{ flex: 1, backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem', minHeight: 42 }}>
                      ✅ CONFIRMAR VENTA (borrador)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CARRITO */}
            <div style={cardStyle}>
              <h3 style={{ color: theme.subtext, fontSize: '0.9rem', marginTop: 0 }}>🛒 ARTÍCULOS EN CARRITO</h3>
              {ventaEditando && (
                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ color: '#92400e', fontWeight: 800, fontSize: '0.85rem' }}>✏️ Editando venta #{ventaEditando.id}</span>
                  <button onClick={cancelarEdicionVenta} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>✕ Cancelar edición</button>
                </div>
              )}

              {carritoConPreciosVivos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: theme.subtext }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛒</div>
                  <div>El carrito está vacío</div>
                </div>
              )}

              {carritoConPreciosVivos.map(item => {
                const clave = claveCarrito(item);
                const variedades = variedadesDeItem(item);
                return (
                <div
                   key={clave}
                  style={{
                    display: 'flex', justifyContent: 'space-between', padding: '14px 0',
                    borderBottom: `1px solid ${theme.border}`, color: theme.text, alignItems: 'center',
                    gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap'
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
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0,
                      backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${theme.border}`
                    }}>
                      {item.imagen
                        ? <img src={item.imagen} alt={tituloDe(item)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '1.5rem' }}>📦</span>
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* NOMBRE DEL RENGLÓN: por defecto producto · variedad y se
                          puede renombrar a mano (opcional; manda en el ticket). */}
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}
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
                            {variedades.map((v: any) => <option key={v.id} value={v.id}>{v.nombre}{v.codigo ? ` · ${v.codigo}` : ''}</option>)}
                          </select>
                        )}
                        <span>Precio unitario:</span>
                        <input 
                          type="number" 
                          value={Math.round(item.precio_venta || item.precio_original_minorista || 0)} 
                          onChange={e => manejarCambioPrecioInput(clave, e.target.value)}
                          style={{
                            ...inputStyle, width: '95px', padding: '4px 8px',
                            display: 'inline-block', marginBottom: 0, fontWeight: 'bold',
                            color: item.esPromoAplicada || item.precioModificado ? '#10b981' : theme.text
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
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#10b981' }}>
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

          {/* RESUMEN LATERAL: totales, cobro y último ticket. Sticky en
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
                etiqueta="⚡ AJUSTE PORCENTUAL MASIVO SOBRE EL CARRITO"
                placeholder="Ej: 10 equivale a 10%"
              />

              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>LISTA DE PRECIOS</label>
                <select value={listaSeleccionada} onChange={e => setListaSeleccionada(e.target.value as any)} style={inputStyle}>
                  <option value="precio_minorista">🍏 Tarifa Minorista Estándar</option>
                  <option value="precio_promo">🔥 Forzar Lista Promociones</option>
                </select>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>DESCUENTO DIRECTO ($)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={descuento}
                  onChange={e => setDescuento(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>DESCUENTO EN EFECTIVO ($)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={descuentoEfectivo}
                  onChange={e => setDescuentoEfectivo(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>MÉTODO DE PAGO</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputStyle}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Cuenta Corriente</option>
                </select>
              </div>

              {metodoPago === 'Efectivo' && (
                <div style={{ marginTop: '14px' }}>
                  <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>CON CUÁNTO PAGAN ($)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={montoEntregado}
                    onChange={e => setMontoEntregado(e.target.value)}
                    style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}
                  />
                  {Number(montoEntregado) > 0 && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700, letterSpacing: '0.5px' }}>VUELTO A ENTREGAR</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857', fontFamily: 'monospace' }}>
                        ${Math.max(0, Number(montoEntregado) - totalConDescuento()).toLocaleString('es-AR')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '18px', borderTop: `1px dashed ${theme.border}`, paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: theme.subtext, marginBottom: '6px' }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: 'monospace' }}>${subtotalCarrito().toLocaleString()}</span>
                </div>
                {descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#10b981', marginBottom: '6px' }}>
                    <span>Descuento</span>
                    <span style={{ fontFamily: 'monospace' }}>−${descuento.toLocaleString()}</span>
                  </div>
                )}
                {descuentoEfectivo > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b', marginBottom: '6px' }}>
                    <span>Desc. Efectivo</span>
                    <span style={{ fontFamily: 'monospace' }}>−${descuentoEfectivo.toLocaleString()}</span>
                  </div>
                )}
                <div style={{
                  backgroundColor: theme.bg, padding: '14px', borderRadius: '14px',
                  border: `1px solid ${theme.border}`, textAlign: 'right', marginTop: '10px'
                }}>
                  <div style={{ fontSize: '0.7rem', color: theme.subtext, fontWeight: 700, letterSpacing: '0.6px' }}>TOTAL CAJA</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace', lineHeight: 1.15 }}>
                    ${totalConDescuento().toLocaleString()}
                  </div>
                </div>
                {metodoPago === 'Efectivo' && Number(montoEntregado) > 0 && Number(montoEntregado) > totalConDescuento() && (
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700, letterSpacing: '0.5px' }}>VUELTO A ENTREGAR</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#047857', fontFamily: 'monospace' }}>
                      ${Math.max(0, Number(montoEntregado) - totalConDescuento()).toLocaleString('es-AR')}
                    </div>
                  </div>
                )}

                <button
                  onClick={borradorActivo != null ? completarBorrador : finalizarVenta}
                  disabled={carrito.length === 0}
                  style={{
                    width: '100%', marginTop: '15px', backgroundColor: '#10b981', color: '#fff',
                    border: 'none', padding: '17px', borderRadius: '14px', fontWeight: 900,
                    fontSize: '1.05rem', cursor: carrito.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: carrito.length === 0 ? 0.45 : 1, transition: 'filter .15s ease',
                    minHeight: 54
                  }}
                  onMouseEnter={(e: any) => { if (carrito.length > 0) e.currentTarget.style.filter = 'brightness(1.12)'; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.filter = 'none'; }}
                >
                  {ventaEditando ? '💾 GUARDAR CAMBIOS' : '✅ COMPLETAR OPERACIÓN'}
                </button>
              </div>
            </div>

            {ticketFinal && (
              <div style={cardStyle}>
                <h4 style={{ color: theme.text, marginBottom: '10px', marginTop: 0, fontSize: '0.9rem' }}>Último Ticket Emitido</h4>
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
            )}
          </div>
        </div>
      )}

      {/* Modal de venta rápida por monto */}
      {ventaRapidaAbierta && (
        <div onClick={() => setVentaRapidaAbierta(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: theme.card, borderRadius: '20px', width: '100%', maxWidth: '420px', border: `1px solid ${theme.border}`, padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px', color: '#f59e0b', fontSize: '1.1rem', fontWeight: 900 }}>⚡ VENTA RÁPIDA POR MONTO</h3>
            <p style={{ color: theme.subtext, fontSize: '0.85rem', margin: '0 0 16px' }}>Se guarda como borrador: no afecta la caja hasta que la completes con los productos.</p>
            <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>MONTO ($)</label>
            <input type="number" inputMode="numeric" value={montoRapido} onChange={e => setMontoRapido(e.target.value)} placeholder="0" style={{ ...inputStyle, marginBottom: '12px', fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }} autoFocus />
            <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>DESCRIPCIÓN (opcional)</label>
            <input type="text" value={descRapido} onChange={e => setDescRapido(e.target.value)} placeholder="Ej: Varios / mostrador" style={{ ...inputStyle, marginBottom: '12px' }} />
            <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: 700, display: 'block', marginBottom: '6px' }}>MÉTODO DE PAGO</label>
            <select value={metodoRapido} onChange={e => setMetodoRapido(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }}>
              <option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Cuenta Corriente</option>
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setVentaRapidaAbierta(false)} style={{ flex: 1, backgroundColor: 'transparent', color: theme.text, border: `1px solid ${theme.border}`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
              <button onClick={guardarBorrador} style={{ flex: 1, backgroundColor: '#f59e0b', color: '#1f2937', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900 }}>Guardar borrador</button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso flotante al escanear */}
      {avisoAgregado && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2500, backgroundColor: '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', boxShadow: '0 8px 24px rgba(16,185,129,0.4)', pointerEvents: 'none' }}>
          ✓ Agregado: {avisoAgregado}
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