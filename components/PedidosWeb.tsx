"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../app/supabase';
import { useToast } from './ui/Avisos';

interface PedidoWebProps {
  darkMode?: boolean;
  /** Vendedor que está usando el sistema ahora (si tu app ya sabe quién es). Se sugiere al tomar un pedido. */
  vendedorActual?: string;
  /** Lista opcional de vendedores para el desplegable de sugerencias. */
  vendedores?: string[];
}

interface Pedido {
  id: number;
  created_at: string;
  nombre: string;
  telefono: string;
  metodo_envio: string;
  direccion: string;
  productos: any[];
  total: number;
  estado: string;
  vendedor?: string;
}

/* ============================================================
   MOTIVOS (opcionales) POR LOS QUE UN PRODUCTO NO SE ENVÍA COMPLETO
   ============================================================ */
const MOTIVOS = [
  { id: 'falta_stock', label: 'Falta de stock' },
  { id: 'stock_insuficiente', label: 'Stock insuficiente (se envían menos)' },
  { id: 'discontinuado', label: 'Producto discontinuado' },
  { id: 'danado', label: 'Producto dañado / defectuoso' },
  { id: 'cliente', label: 'A pedido del cliente' },
  { id: 'otro', label: 'Otro motivo' },
];
const MOTIVOS_SIN_STOCK = ['falta_stock', 'stock_insuficiente'];
const motivoLabel = (id: string) => MOTIVOS.find(m => m.id === id)?.label || '';

/* ============================================================
   UTILIDADES DE ÍTEMS DEL PEDIDO
   (todo se guarda dentro de cada ítem de pedidos_web.productos, no hace falta columna nueva)
   ============================================================ */
const cantPedida = (it: any): number => Number(it?.cantidad_pedida ?? it?.cantidad ?? it?.unidades ?? 1) || 1;

const cantEnviada = (it: any): number => {
  const v = it?.cantidad_enviada;
  if (v === undefined || v === null || v === '') return cantPedida(it);
  return Math.max(0, Number(v) || 0);
};

const precioItem = (it: any): number => Number(it?.producto?.precio ?? it?.precio ?? 0);
const nombreItem = (it: any): string => it?.producto?.nombre || it?.nombre || 'Producto';
const nombreCompletoItem = (it: any): string => nombreItem(it) + (it?.variedad?.nombre ? ` (${it.variedad.nombre})` : '');
const idProducto = (it: any) => (it?.producto ? it.producto.id : (it?.producto_id ?? it?.id));

type EstadoItem = 'sin_preparar' | 'listo' | 'parcial' | 'no_enviado';
const estadoItem = (it: any): EstadoItem => {
  const env = cantEnviada(it);
  const ped = cantPedida(it);
  if (env <= 0) return 'no_enviado';
  if (env < ped) return 'parcial';
  return it?.listo ? 'listo' : 'sin_preparar';
};

const estaResuelto = (it: any) => estadoItem(it) !== 'sin_preparar';

const normalizarItems = (productos: any[]): any[] =>
  (productos || []).map((it: any) => ({
    ...it,
    cantidad_pedida: cantPedida(it),
    cantidad_enviada: cantEnviada(it),
    listo: !!it.listo,
    motivo: it.motivo || '',
    nota: it.nota || '',
    sin_stock: !!it.sin_stock,
  }));

// Deja el ítem prolijo antes de guardarlo (si se envía completo, se borran motivo/nota/sin_stock)
const limpiarItem = (it: any) => {
  const ped = cantPedida(it);
  const env = Math.min(ped, cantEnviada(it));
  const incompleto = env < ped;
  return {
    ...it,
    cantidad_pedida: ped,
    cantidad_enviada: env,
    listo: !!it.listo,
    motivo: incompleto ? (it.motivo || '') : '',
    nota: incompleto ? (it.nota || '') : '',
    sin_stock: incompleto ? !!it.sin_stock : false,
  };
};

// El total original puede incluir cargos extra (envío, etc.): solo se descuenta lo que NO se envía
const calcularTotalFinal = (totalOriginal: number, items: any[]): number => {
  const noEnviado = (items || []).reduce((acc, it) => acc + precioItem(it) * Math.max(0, cantPedida(it) - cantEnviada(it)), 0);
  return Math.max(0, Number(totalOriginal || 0) - noEnviado);
};

// Líneas de texto con los ajustes (para WhatsApp y observaciones de la venta)
const resumenAjustes = (items: any[]): string[] =>
  (items || [])
    .filter(it => cantEnviada(it) < cantPedida(it))
    .map(it => {
      const env = cantEnviada(it);
      const ped = cantPedida(it);
      const motivo = it.motivo ? ` - ${motivoLabel(it.motivo)}` : '';
      const nota = it.nota ? ` (${it.nota})` : '';
      return env === 0
        ? `No enviado: ${nombreCompletoItem(it)}${motivo}${nota}`
        : `Enviado ${env} de ${ped}: ${nombreCompletoItem(it)}${motivo}${nota}`;
    });

// Vendedor del pedido: se guarda en la columna "vendedor" (si existe) y siempre dentro de cada ítem
const getVendedor = (p: Pedido | null | undefined): string =>
  (p?.vendedor || (p?.productos || []).find((it: any) => it?.vendedor)?.vendedor || '').toString().trim();

const guardarVendedorLocal = (nombre: string) => {
  try { localStorage.setItem('pedidos_vendedor', nombre); } catch { /* sin acceso a localStorage */ }
};

export default function PedidosWeb({ darkMode = true, vendedorActual = '', vendedores = [] }: PedidoWebProps) {
  const toast = useToast();
  const { confirmar } = toast;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  // Modo de presentación de los pedidos: tarjetas (visual) o lista (compacto, para
  // ver muchos pedidos de un vistazo). Se recuerda entre visitas.
  const [vista, setVista] = useState<'tarjetas' | 'lista'>(() => {
    if (typeof window === 'undefined') return 'tarjetas';
    try { return window.localStorage.getItem('vistaPedidos') === 'lista' ? 'lista' : 'tarjetas'; } catch { return 'tarjetas'; }
  });

  const cambiarVista = (nueva: 'tarjetas' | 'lista') => {
    setVista(nueva);
    try { window.localStorage.setItem('vistaPedidos', nueva); } catch { /* modo privado */ }
  };
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);

  // Ítems del pedido abierto (borrador editable) y control de cambios sin guardar
  const [itemsTrabajo, setItemsTrabajo] = useState<any[]>([]);
  const [hayCambios, setHayCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados para el modal de pago al completar pedido
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [pedidoACompletar, setPedidoACompletar] = useState<Pedido | null>(null);
  const [itemsACompletar, setItemsACompletar] = useState<any[]>([]);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState<'Efectivo' | 'Transferencia' | 'Cuenta Corriente'>('Efectivo');
  const [clientesLista, setClientesLista] = useState<any[]>([]);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  // Vendedor que prepara el pedido abierto / vendedor que figura al cobrar
  const [vendedorTrabajo, setVendedorTrabajo] = useState('');
  const [vendedorCobro, setVendedorCobro] = useState('');
  const [vendedorPorDefecto, setVendedorPorDefecto] = useState(vendedorActual);

  useEffect(() => {
    if (vendedorActual) { setVendedorPorDefecto(vendedorActual); return; }
    try {
      const guardado = localStorage.getItem('pedidos_vendedor');
      if (guardado) setVendedorPorDefecto(guardado);
    } catch { /* sin acceso a localStorage */ }
  }, [vendedorActual]);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#1e293b',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    hover: darkMode ? '#334155' : '#f1f5f9',
    innerBox: darkMode ? '#0f172a' : '#f1f5f9'
  };

  const cargarPedidosYClientes = async () => {
    setCargando(true);
    try {
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos_web')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (pedidosError) throw pedidosError;
      if (pedidosData) setPedidos(pedidosData);

      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (!clientesError && clientesData) {
        setClientesLista(clientesData);
      }
    } catch (err: any) {
      console.error("Error al cargar datos:", err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPedidosYClientes();

    const canalPedidos = supabase.channel('custom-insert-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos_web' },
        (payload) => {
          setPedidos((prevPedidos) => [payload.new as Pedido, ...prevPedidos]);
          toast.exito(`¡Nuevo pedido recibido de ${payload.new.nombre}!`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalPedidos);
    };
  }, []);

  // Guarda el pedido. El vendedor va en la columna "vendedor" si existe y, además, dentro de cada ítem
  // (así queda registrado aunque no hayas creado la columna).
  const guardarPedidoDB = async (id: number, campos: { estado?: string; productos: any[]; vendedor?: string }) => {
    const { vendedor, ...resto } = campos;
    const v = (vendedor || '').trim();
    const productos = resto.productos.map(it => ({ ...it, vendedor: v }));
    const base = { ...resto, productos };
    let { error } = await supabase.from('pedidos_web').update({ ...base, vendedor: v }).eq('id', id);
    if (error && /column|schema cache/i.test(error.message || '')) {
      ({ error } = await supabase.from('pedidos_web').update(base).eq('id', id));
    }
    return { error, productos, vendedor: v };
  };

  /* ============================================================
     ABRIR / CERRAR DETALLE
     ============================================================ */
  const abrirPedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setItemsTrabajo(normalizarItems(pedido.productos));
    setVendedorTrabajo(getVendedor(pedido) || (esEditable(pedido) ? vendedorPorDefecto : ''));
    setHayCambios(false);
  };

  const cerrarDetalle = async () => {
    if (hayCambios && !(await confirmar({ titulo: 'Descartar cambios', mensaje: 'Tenés cambios sin guardar en este pedido. ¿Cerrar y descartarlos?', textoOk: 'Descartar', peligro: true }))) return;
    setPedidoSeleccionado(null);
    setItemsTrabajo([]);
    setVendedorTrabajo('');
    setHayCambios(false);
  };

  const esEditable = (p: Pedido | null) => !!p && (p.estado === 'pendiente' || p.estado === 'preparando');

  /* ============================================================
     EDICIÓN PRODUCTO POR PRODUCTO
     ============================================================ */
  const actualizarItem = (idx: number, cambios: any) => {
    setItemsTrabajo(prev => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
    setHayCambios(true);
  };

  const alternarListo = (idx: number) => actualizarItem(idx, { listo: !itemsTrabajo[idx].listo });

  const cambiarEnviada = (idx: number, nueva: number) => {
    const it = itemsTrabajo[idx];
    const ped = cantPedida(it);
    const env = Math.max(0, Math.min(ped, nueva));
    const cambios: any = { cantidad_enviada: env };
    // Al enviar menos de lo pedido por primera vez, se sugiere "falta de stock" (se puede cambiar o quitar)
    if (env < ped && !it.motivo) {
      cambios.motivo = 'falta_stock';
      if (!it.variedad) cambios.sin_stock = true;
    }
    actualizarItem(idx, cambios);
  };

  const cambiarMotivo = (idx: number, motivo: string) => {
    const it = itemsTrabajo[idx];
    const cambios: any = { motivo };
    if (MOTIVOS_SIN_STOCK.includes(motivo) && !it.variedad) cambios.sin_stock = true;
    actualizarItem(idx, cambios);
  };

  const marcarTodosListos = () => {
    setItemsTrabajo(prev => prev.map(it => (cantEnviada(it) > 0 ? { ...it, listo: true } : it)));
    setHayCambios(true);
  };

  const guardarProgreso = async (forzarPreparando = false) => {
    if (!pedidoSeleccionado) return;
    const vend = vendedorTrabajo.trim();
    if (forzarPreparando && !vend) return toast.avisar('Escribí el nombre del vendedor que va a preparar el pedido.', 'alerta');
    setGuardando(true);
    try {
      const limpios = itemsTrabajo.map(limpiarItem);
      const hayActividad = limpios.some(it => it.listo || cantEnviada(it) < cantPedida(it));
      // Si estaba pendiente y alguien lo tomó o ya empezó a prepararlo, pasa a "en preparación"
      const nuevoEstado = pedidoSeleccionado.estado === 'pendiente' && (hayActividad || !!vend || forzarPreparando) ? 'preparando' : pedidoSeleccionado.estado;

      const { error, productos, vendedor } = await guardarPedidoDB(pedidoSeleccionado.id, { estado: nuevoEstado, productos: limpios, vendedor: vend });
      if (error) throw error;

      setPedidos(prev => prev.map(p => (p.id === pedidoSeleccionado.id ? { ...p, productos, estado: nuevoEstado, vendedor } : p)));
      setPedidoSeleccionado(prev => (prev ? { ...prev, productos, estado: nuevoEstado, vendedor } : null));
      setItemsTrabajo(normalizarItems(productos));
      setHayCambios(false);
      if (vendedor) guardarVendedorLocal(vendedor);
    } catch (err: any) {
      toast.error('Error al guardar el progreso del pedido: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  /* ============================================================
     COMPLETAR PEDIDO (cobro + venta + sin stock)
     ============================================================ */
  const iniciarProcesoCompletar = (pedido: Pedido) => {
    // Se usan los ítems del borrador si es el pedido abierto (incluye cambios sin guardar)
    const items = pedidoSeleccionado?.id === pedido.id ? itemsTrabajo : normalizarItems(pedido.productos);
    setItemsACompletar(items.map(limpiarItem));
    setPedidoACompletar(pedido);
    setVendedorCobro((pedidoSeleccionado?.id === pedido.id ? vendedorTrabajo : getVendedor(pedido)).trim() || vendedorPorDefecto);
    setMetodoPagoSeleccionado('Efectivo');
    const coincidencia = clientesLista.find(c => 
      c.nombre?.toLowerCase().trim() === pedido.nombre?.toLowerCase().trim() ||
      c.telefono?.toString().trim() === pedido.telefono?.toString().trim()
    );
    setClienteIdSeleccionado(coincidencia ? String(coincidencia.id) : (clientesLista[0]?.id ? String(clientesLista[0].id) : ''));
    setMostrarModalPago(true);
  };

  const confirmarCompletarPedidoConPago = async () => {
    if (!pedidoACompletar || procesandoPago) return;

    // Al completar, lo que se envía queda "listo"; lo que no se envía, no
    const itemsFinales = itemsACompletar.map(limpiarItem).map(it => ({ ...it, listo: cantEnviada(it) > 0 }));
    const enviados = itemsFinales.filter(it => cantEnviada(it) > 0);
    const totalFinal = calcularTotalFinal(pedidoACompletar.total, itemsFinales);

    if (enviados.length === 0) {
      return toast.avisar('No hay ningún producto para enviar. Si no se puede entregar nada, cancelá el pedido en lugar de completarlo.', 'alerta');
    }

    const vendedorFinal = vendedorCobro.trim();
    if (!vendedorFinal) return toast.avisar('Indicá qué vendedor preparó este pedido.', 'alerta');

    // Validación ANTES de tocar la base de datos
    let clienteObj: any = null;
    if (metodoPagoSeleccionado === 'Cuenta Corriente') {
      if (!clienteIdSeleccionado) return toast.avisar('Por favor seleccioná una cuenta corriente / cliente válido.', 'alerta');
      clienteObj = clientesLista.find(c => String(c.id) === String(clienteIdSeleccionado));
      if (!clienteObj) return toast.avisar('No se encontró el cliente seleccionado.', 'alerta');
    }

    setProcesandoPago(true);
    try {
      // 1. Pedido: estado + detalle de lo enviado / no enviado
      const { error: errorPedido, productos: itemsGuardados } = await guardarPedidoDB(pedidoACompletar.id, { estado: 'completado', productos: itemsFinales, vendedor: vendedorFinal });
      if (errorPedido) throw errorPedido;

      // 2. Cuenta corriente (solo por lo realmente enviado)
      let clienteNombreFinal = pedidoACompletar.nombre;
      let clienteIdFinal = null;
      if (clienteObj) {
        clienteNombreFinal = clienteObj.nombre;
        clienteIdFinal = clienteObj.id;
        const nuevoSaldo = Number(clienteObj.saldo_cc || 0) + totalFinal;
        const { error: errorCliente } = await supabase.from('clientes').update({ saldo_cc: nuevoSaldo }).eq('id', clienteObj.id);
        if (errorCliente) throw errorCliente;
      }

      // 3. Venta: solo con las unidades enviadas, con el detalle de los ajustes
      const itemsVenta = enviados.map(it => ({
        nombre: nombreCompletoItem(it),
        unidades: cantEnviada(it),
        precio_venta: precioItem(it),
        precio_costo: Number(it.producto?.precio_costo || 0),
        ...(cantEnviada(it) < cantPedida(it)
          ? { pedido_original: cantPedida(it), motivo: motivoLabel(it.motivo), nota: it.nota || '' }
          : {})
      }));

      const ajustes = resumenAjustes(itemsFinales);
      const ventaBase = {
        id: Date.now(),
        fecha: new Date().toLocaleString('es-AR'),
        items: itemsVenta,
        subtotal: totalFinal,
        descuento: 0,
        total: totalFinal,
        metodo_pago: metodoPagoSeleccionado,
        cliente_id: clienteIdFinal,
        cliente_nombre: clienteNombreFinal,
        estado: 'completada'
      };
      const observaciones = `Pedido web #${pedidoACompletar.id.toString().padStart(4, '0')} | Vendedor: ${vendedorFinal}` + (ajustes.length ? ' | ' + ajustes.join(' | ') : '');

      // Se guardan las columnas extra que existan en "ventas" (vendedor, pedido_web_id, observaciones); si alguna no existe, se prueba sin ella
      const intentos: any[] = [
        { ...ventaBase, pedido_web_id: pedidoACompletar.id, observaciones, vendedor: vendedorFinal },
        { ...ventaBase, pedido_web_id: pedidoACompletar.id, observaciones },
        ventaBase
      ];
      let errorVenta: any = null;
      for (const intento of intentos) {
        const { error } = await supabase.from('ventas').insert([intento]);
        errorVenta = error;
        if (!error || !/column|schema cache/i.test(error.message || '')) break;
      }
      if (errorVenta) throw errorVenta;

      // 4. Productos que no se pudieron completar → quedan SIN STOCK (igual que en Gestión de Stock)
      let marcados = 0;
      let avisoSinStock = '';
      const aMarcar = itemsFinales.filter(it => it.sin_stock && cantEnviada(it) < cantPedida(it));
      if (aMarcar.length > 0) {
        try {
          const ids = Array.from(new Set(aMarcar.map(idProducto).filter(v => v !== undefined && v !== null && v !== '')));
          const nombresSinId = Array.from(new Set(aMarcar.filter(it => {
            const id = idProducto(it);
            return id === undefined || id === null || id === '';
          }).map(nombreItem)));

          if (ids.length > 0) {
            const { error } = await supabase.from('stock').update({ sin_stock: true }).in('id', ids as any[]);
            if (error) throw error;
            marcados += ids.length;
          }
          for (const nombre of nombresSinId) {
            const { error } = await supabase.from('stock').update({ sin_stock: true }).eq('nombre', nombre);
            if (error) throw error;
            marcados++;
          }
        } catch (errStock: any) {
          avisoSinStock = `\n\n⚠️ La venta se registró, pero no se pudieron marcar como "sin stock" los productos: ${errStock.message}`;
        }
      }

      // 5. Estado local
      setPedidos(prev => prev.map(p => (p.id === pedidoACompletar.id ? { ...p, estado: 'completado', productos: itemsGuardados, vendedor: vendedorFinal } : p)));
      if (pedidoSeleccionado?.id === pedidoACompletar.id) {
        setPedidoSeleccionado(prev => (prev ? { ...prev, estado: 'completado', productos: itemsGuardados, vendedor: vendedorFinal } : null));
        setItemsTrabajo(normalizarItems(itemsGuardados));
        setVendedorTrabajo(vendedorFinal);
        setHayCambios(false);
      }
      guardarVendedorLocal(vendedorFinal);

      setMostrarModalPago(false);
      setPedidoACompletar(null);
      toast.exito(
        `Pedido completado y registrado en Cierre de Caja / Cuenta Corriente por $${totalFinal.toLocaleString('es-AR')}.` +
        (marcados > 0 ? ` ${marcados} producto${marcados > 1 ? 's' : ''} marcado${marcados > 1 ? 's' : ''} como SIN STOCK.` : '') +
        avisoSinStock.replace(/\n+/g, ' '),
        9000
      );
      cargarPedidosYClientes();
    } catch (err: any) {
      toast.error('Error al procesar el pago del pedido: ' + err.message);
    } finally {
      setProcesandoPago(false);
    }
  };

  const actualizarEstadoDirecto = async (id: number, nuevoEstado: string) => {
    if (nuevoEstado === 'completado') {
      const pedidoObj = pedidos.find(p => p.id === id);
      if (pedidoObj) {
        iniciarProcesoCompletar(pedidoObj);
        return;
      }
    }

    if (nuevoEstado === 'cancelado' && !(await confirmar({ titulo: 'Cancelar pedido', mensaje: '¿Cancelar este pedido? No se registra ninguna venta ni se descuenta nada.', textoOk: 'Sí, cancelar', peligro: true }))) return;

    try {
      // Si es el pedido abierto, se guardan junto con el nuevo estado los cambios pendientes y el vendedor
      const esElAbierto = pedidoSeleccionado?.id === id;
      const pedidoBase = pedidos.find(p => p.id === id);
      const itemsBase = esElAbierto ? itemsTrabajo.map(limpiarItem) : normalizarItems(pedidoBase?.productos || []);
      const vend = esElAbierto ? vendedorTrabajo : getVendedor(pedidoBase);

      const { error, productos, vendedor } = await guardarPedidoDB(id, { estado: nuevoEstado, productos: itemsBase, vendedor: vend });
      if (error) throw error;

      const payload = { estado: nuevoEstado, productos, vendedor };
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));
      if (esElAbierto) {
        setPedidoSeleccionado(prev => prev ? { ...prev, ...payload } : null);
        setItemsTrabajo(normalizarItems(productos));
        setHayCambios(false);
      }
    } catch (err: any) {
      toast.error("Error al actualizar estado: " + err.message);
    }
  };

  const eliminarPedido = async (id: number) => {
    if (!(await confirmar({ titulo: 'Eliminar pedido', mensaje: "¿Estás seguro de eliminar este pedido del registro?", textoOk: "Eliminar", peligro: true }))) return;
    try {
      const { error } = await supabase.from('pedidos_web').delete().eq('id', id);
      if (error) throw error;
      setPedidos(prev => prev.filter(p => p.id !== id));
      setPedidoSeleccionado(null);
      setItemsTrabajo([]);
      setHayCambios(false);
    } catch (err: any) {
      toast.error("Error al eliminar: " + err.message);
    }
  };

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const generarPDFAdmin = async (pedido: Pedido, items: any[], vendedor: string) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const lista = items && items.length ? items : normalizarItems(pedido.productos);
      const totalFinal = calcularTotalFinal(pedido.total, lista);
      const hayAjustes = lista.some(it => cantEnviada(it) < cantPedida(it));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text("DISTRIBUIDORA INDIA", 105, 25, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Comprobante de Pedido #${pedido.id.toString().padStart(4, '0')}`, 105, 35, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("DATOS DEL CLIENTE", 20, 52);
      
      doc.setFont("helvetica", "normal");
      doc.text(`Nombre: ${pedido.nombre}`, 20, 60);
      doc.text(`Teléfono: ${pedido.telefono}`, 20, 67);
      
      doc.text(`Entrega: ${pedido.metodo_envio === 'envio' ? 'Envío a Domicilio' : 'Retiro en Local'}`, 20, 74);
      let yDatos = 81;
      if (pedido.metodo_envio === 'envio') {
        doc.text(`Dirección: ${pedido.direccion}`, 20, yDatos);
        yDatos += 7;
      }
      if (vendedor) {
        doc.text(`Vendedor: ${vendedor}`, 20, yDatos);
        yDatos += 7;
      }

      let startY = yDatos + 4;
      doc.line(20, startY, 190, startY);
      
      startY += 10;
      doc.setFont("helvetica", "bold");
      doc.text("DETALLE DEL PEDIDO", 20, startY);
      
      startY += 10;
      doc.setFont("helvetica", "normal");
      
      lista.forEach((item: any) => {
        const ped = cantPedida(item);
        const env = cantEnviada(item);
        const precioProd = precioItem(item);

        const nombreCompleto = nombreCompletoItem(item);
        const nombreTruncado = nombreCompleto.length > 42 ? nombreCompleto.substring(0, 39) + "..." : nombreCompleto;

        if (env === 0) {
          doc.setTextColor(148, 163, 184);
          doc.text(`0x  ${nombreTruncado}  (pidió ${ped})`, 20, startY);
          doc.text("NO ENVIADO", 190, startY, { align: 'right' });
        } else {
          doc.setTextColor(15, 23, 42);
          doc.text(`${env}x  ${nombreTruncado}${env < ped ? `  (pidió ${ped})` : ''}`, 20, startY);
          doc.text(`$ ${(precioProd * env).toLocaleString('es-AR')}`, 190, startY, { align: 'right' });
        }
        startY += 8;

        if (env < ped && item.motivo) {
          doc.setFontSize(9);
          doc.setTextColor(120, 130, 145);
          doc.text(`   Motivo: ${motivoLabel(item.motivo)}${item.nota ? ' - ' + item.nota : ''}`, 20, startY - 2);
          doc.setFontSize(11);
          startY += 4;
        }
        
        if (startY > 270) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.setTextColor(15, 23, 42);
      startY += 5;
      doc.line(20, startY, 190, startY);
      startY += 10;
      if (hayAjustes) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Total del pedido original: $ ${Number(pedido.total).toLocaleString('es-AR')}`, 190, startY, { align: 'right' });
        startY += 9;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(hayAjustes ? "TOTAL A PAGAR:" : "TOTAL:", 120, startY);
      doc.text(`$ ${totalFinal.toLocaleString('es-AR')}`, 190, startY, { align: 'right' });

      doc.save(`Pedido_${pedido.id}_${pedido.nombre.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el PDF.");
    }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const pasaFiltro = filtroEstado === 'todos' || p.estado === filtroEstado;
    const pasaBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                         p.id.toString().includes(busqueda);
    return pasaFiltro && pasaBusqueda;
  });

  const getStatusColor = (estado: string) => {
    switch(estado) {
      case 'pendiente': return '#f59e0b';
      case 'preparando': return '#3b82f6';
      case 'completado': return '#10b981';
      case 'cancelado': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch(estado) {
      case 'pendiente': return '🟠 Pendiente';
      case 'preparando': return '🔵 En Preparación';
      case 'completado': return '🟢 Completado';
      case 'cancelado': return '🔴 Cancelado';
      default: return estado;
    }
  };

  const colorEstadoItem = (e: EstadoItem) =>
    e === 'listo' ? '#10b981' : e === 'parcial' ? '#f59e0b' : e === 'no_enviado' ? '#ef4444' : theme.subtext;

  const etiquetaEstadoItem = (e: EstadoItem) =>
    e === 'listo' ? '✅ Listo' : e === 'parcial' ? '🟡 Se envía menos' : e === 'no_enviado' ? '🔴 No se envía' : '⏳ Sin preparar';

  const progresoPedido = (p: Pedido) => {
    const its = normalizarItems(p.productos);
    return {
      total: its.length,
      resueltos: its.filter(estaResuelto).length,
      ajustes: its.filter(it => cantEnviada(it) < cantPedida(it)).length,
      its
    };
  };

  /* ============================================================
     RENDER DE UN ÍTEM DEL PEDIDO (editable o solo lectura)
     ============================================================ */
  const btnMini: React.CSSProperties = { width: '32px', height: '34px', border: 'none', backgroundColor: theme.card, color: theme.text, cursor: 'pointer', fontWeight: 900, fontSize: '1rem' };
  const campo: React.CSSProperties = { padding: '9px 10px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.card, color: theme.text, fontSize: '0.85rem', outline: 'none', minWidth: 0 };

  const renderItem = (item: any, idx: number, editable: boolean) => {
    const ped = cantPedida(item);
    const env = cantEnviada(item);
    const precio = precioItem(item);
    const estado = estadoItem(item);
    const incompleto = env < ped;
    const color = colorEstadoItem(estado);
    const imagenItem = item.variedad?.imagen_url || item.producto?.img;

    return (
      <div key={idx} style={{ padding: '14px 16px', backgroundColor: theme.bg, borderRadius: '16px', border: `1px solid ${incompleto ? color + '55' : theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px', opacity: estado === 'no_enviado' && !editable ? 0.75 : 1 }}>

        {/* Cabecera del ítem */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          {imagenItem && (
            <div style={{ width: '45px', height: '45px', borderRadius: '10px', overflow: 'hidden', background: theme.card, border: `1px solid ${theme.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={imagenItem} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <span style={{ backgroundColor: theme.card, padding: '6px 10px', borderRadius: '10px', fontWeight: 900, color: theme.text, border: `1px solid ${theme.border}`, flexShrink: 0 }}>
              {incompleto ? <><s style={{ opacity: 0.5, fontWeight: 600 }}>{ped}</s> {env}x</> : `${ped}x`}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme.text, fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreItem(item)}</div>
              {item.variedad && (
                <div style={{ color: theme.primary, fontWeight: 800, fontSize: '0.82rem' }}>
                  Variedad: {item.variedad.nombre}
                </div>
              )}
              <div style={{ color: theme.subtext, fontSize: '0.75rem' }}>Precio unit: ${precio.toLocaleString('es-AR')}</div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: estado === 'no_enviado' ? theme.subtext : theme.text, fontWeight: 900, fontSize: '1.1rem', textDecoration: estado === 'no_enviado' ? 'line-through' : 'none' }}>
              ${(precio * (estado === 'no_enviado' ? ped : env)).toLocaleString('es-AR')}
            </div>
            {incompleto && estado !== 'no_enviado' && (
              <div style={{ color: theme.subtext, fontSize: '0.7rem', textDecoration: 'line-through' }}>${(precio * ped).toLocaleString('es-AR')}</div>
            )}
          </div>
        </div>

        {/* Controles (solo pedidos pendientes / en preparación) */}
        {editable && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => alternarListo(idx)}
                disabled={env === 0}
                style={{ padding: '8px 14px', borderRadius: '10px', border: `2px solid ${item.listo && env > 0 ? '#10b981' : theme.border}`, backgroundColor: item.listo && env > 0 ? '#10b98118' : theme.card, color: item.listo && env > 0 ? '#10b981' : theme.subtext, fontWeight: 800, cursor: env === 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: env === 0 ? 0.5 : 1 }}
              >
                {item.listo && env > 0 ? '✅ Listo' : '☐ Marcar listo'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.subtext }}>Enviar:</span>
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                  <button onClick={() => cambiarEnviada(idx, env - 1)} disabled={env <= 0} style={{ ...btnMini, opacity: env <= 0 ? 0.4 : 1 }} aria-label="Enviar una unidad menos">−</button>
                  <span style={{ minWidth: '34px', textAlign: 'center', fontWeight: 900, color: incompleto ? color : theme.text }}>{env}</span>
                  <button onClick={() => cambiarEnviada(idx, env + 1)} disabled={env >= ped} style={{ ...btnMini, opacity: env >= ped ? 0.4 : 1 }} aria-label="Enviar una unidad más">+</button>
                </div>
                <span style={{ fontSize: '0.78rem', color: theme.subtext }}>de {ped}</span>
              </div>

              {env > 0 && (
                <button onClick={() => cambiarEnviada(idx, 0)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #ef444455', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                  🚫 No enviar
                </button>
              )}
              {env < ped && (
                <button onClick={() => cambiarEnviada(idx, ped)} style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.subtext, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                  ↩ Enviar completo
                </button>
              )}

              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 800, color }}>{etiquetaEstadoItem(estado)}</span>
            </div>

            {incompleto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '12px', backgroundColor: theme.innerBox, border: `1px dashed ${color}66` }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={item.motivo || ''} onChange={(e) => cambiarMotivo(idx, e.target.value)} style={{ ...campo, flex: '1 1 200px' }}>
                    <option value="">Motivo (opcional)…</option>
                    {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Nota (opcional): ej. llega el jueves"
                    value={item.nota || ''}
                    onChange={(e) => actualizarItem(idx, { nota: e.target.value })}
                    style={{ ...campo, flex: '2 1 220px' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.83rem', color: theme.text, fontWeight: 600 }}>
                  <input type="checkbox" checked={!!item.sin_stock} onChange={(e) => actualizarItem(idx, { sin_stock: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }} />
                  🚫 Marcar el producto como SIN STOCK en el sistema al completar el pedido
                </label>
                {item.variedad && item.sin_stock && (
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                    ⚠️ Se marca el producto completo, no solo la variedad "{item.variedad.nombre}".
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Solo lectura: detalle de lo que pasó */}
        {!editable && (incompleto || item.listo) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontWeight: 800, color, backgroundColor: color + '18', border: `1px solid ${color}40` }}>
              {estado === 'no_enviado' ? 'No enviado' : estado === 'parcial' ? `Enviado ${env} de ${ped}` : 'Enviado completo'}
            </span>
            {incompleto && item.motivo && <span style={{ color: theme.subtext }}>Motivo: <strong style={{ color: theme.text }}>{motivoLabel(item.motivo)}</strong></span>}
            {incompleto && item.nota && <span style={{ color: theme.subtext }}>“{item.nota}”</span>}
            {incompleto && item.sin_stock && <span style={{ color: '#f59e0b', fontWeight: 700 }}>🚫 Marcado sin stock</span>}
          </div>
        )}
      </div>
    );
  };

  /* ---------- Datos derivados del pedido abierto ---------- */
  const editable = esEditable(pedidoSeleccionado);
  const totalOriginalSel = pedidoSeleccionado ? Number(pedidoSeleccionado.total) : 0;
  const totalFinalSel = pedidoSeleccionado ? calcularTotalFinal(pedidoSeleccionado.total, itemsTrabajo) : 0;
  const resueltosSel = itemsTrabajo.filter(estaResuelto).length;
  const ajustesSel = itemsTrabajo.filter(it => cantEnviada(it) < cantPedida(it)).length;

  // Datos del modal de cobro
  const totalFinalCobro = pedidoACompletar ? calcularTotalFinal(pedidoACompletar.total, itemsACompletar) : 0;
  const ajustesCobro = itemsACompletar.filter(it => cantEnviada(it) < cantPedida(it));
  const sinStockCobro = ajustesCobro.filter(it => it.sin_stock);
  const sinPrepararCobro = itemsACompletar.filter(it => estadoItem(it) === 'sin_preparar');

  // Sugerencias de vendedores: los que ya figuran en pedidos anteriores + los que pases por props
  const opcionesVendedores = Array.from(new Set([
    ...vendedores,
    vendedorActual,
    vendedorPorDefecto,
    ...pedidos.map(p => getVendedor(p))
  ].map(v => (v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <datalist id="lista-vendedores">
        {opcionesVendedores.map(v => <option key={v} value={v} />)}
      </datalist>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.card, padding: '24px', borderRadius: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: theme.subtext }}>Pedidos recibidos desde la web: prepará, cobrá y sincronizá el stock</p>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="🔍 Buscar cliente o #ID..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ padding: '12px 18px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, outline: 'none', minWidth: '220px', fontSize: '0.95rem' }}
          />
          
          <select 
            value={filtroEstado} 
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '12px 18px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, outline: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
          >
            <option value="todos">Todos los pedidos</option>
            <option value="pendiente">🟠 Pendientes</option>
            <option value="preparando">🔵 En Preparación</option>
            <option value="completado">🟢 Completados / Entregados</option>
            <option value="cancelado">🔴 Cancelados</option>
          </select>

          {/* Alternar entre tarjetas y lista */}
          <div style={{
            display: 'flex', gap: 2, padding: 3, borderRadius: '12px',
            border: `1px solid ${theme.border}`, backgroundColor: theme.bg, marginLeft: 'auto'
          }} role="group" aria-label="Modo de visualización">
            {([
              { id: 'tarjetas' as const, texto: 'Tarjetas', icono: '▦' },
              { id: 'lista' as const, texto: 'Lista', icono: '☰' }
            ]).map((v) => {
              const activo = vista === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => cambiarVista(v.id)}
                  aria-pressed={activo}
                  title={`Ver en modo ${v.texto.toLowerCase()}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: '9px',
                    border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', minHeight: 40,
                    background: activo ? theme.primary : 'transparent',
                    color: activo ? '#fff' : theme.subtext
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>{v.icono}</span>
                  {v.texto}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '60px', color: theme.subtext, fontSize: '1.1rem', fontWeight: 600 }}>⏳ Cargando pedidos...</div>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: theme.card, borderRadius: '20px', border: `2px dashed ${theme.border}`, color: theme.subtext, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '3rem' }}>📭</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>No hay pedidos que coincidan con esta búsqueda.</span>
        </div>
      ) : (
        /* MODO LISTA: una fila por pedido, para ver muchos de un vistazo.
           Mismo orden y mismos datos que las tarjetas, sin cambiar la lógica. */
        vista === 'lista' ? (
          <div style={{
            backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: '18px',
            overflow: 'hidden'
          }}>
            {/* Encabezado de columnas (solo en pantallas con lugar) */}
            <div className="solo-escritorio" style={{
              display: 'grid', gridTemplateColumns: '92px minmax(140px, 2fr) minmax(110px, 1.1fr) minmax(100px, 1fr) 90px minmax(110px, 1fr)',
              gap: '10px', padding: '10px 16px', backgroundColor: theme.bg,
              borderBottom: `1px solid ${theme.border}`, fontSize: '0.68rem', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.subtext
            }}>
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Envío</span>
              <span>Ítems</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>

            {pedidosFiltrados.map((pedido) => {
              const prog = progresoPedido(pedido);
              const enCurso = pedido.estado === 'pendiente' || pedido.estado === 'preparando';
              const totalFinalFila = calcularTotalFinal(pedido.total, prog.its);
              const conAjustesFila = prog.ajustes > 0 && totalFinalFila !== Number(pedido.total);
              const colorEstado = getStatusColor(pedido.estado);

              return (
                <div
                  key={pedido.id}
                  onClick={() => abrirPedido(pedido)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '6px 10px',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${theme.border}`,
                    cursor: 'pointer',
                    alignItems: 'center',
                    borderLeft: `4px solid ${pedido.estado === 'pendiente' ? colorEstado : 'transparent'}`,
                    backgroundColor: pedido.estado === 'pendiente' ? `${colorEstado}0D` : 'transparent'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.hover; }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = pedido.estado === 'pendiente' ? `${colorEstado}0D` : 'transparent';
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: theme.subtext }}>
                    #{pedido.id.toString().padStart(4, '0')}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: theme.text, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pedido.nombre}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: theme.subtext }}>
                      {formatearFecha(pedido.created_at)}
                      {getVendedor(pedido) && ` · ${getVendedor(pedido)}`}
                    </span>
                  </span>

                  <span>
                    <span style={{
                      display: 'inline-block', padding: '3px 9px', borderRadius: '999px',
                      fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                      backgroundColor: `${colorEstado}15`, color: colorEstado, border: `1px solid ${colorEstado}30`
                    }}>
                      {getStatusLabel(pedido.estado)}
                    </span>
                    {enCurso && prog.total > 0 && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: theme.subtext, marginTop: 3 }}>
                        {prog.resueltos}/{prog.total} preparados
                      </span>
                    )}
                  </span>

                  <span style={{ fontSize: '0.82rem', color: theme.subtext }}>
                    {pedido.metodo_envio === 'envio' ? '🏍️ Envío' : '🏬 Retiro'}
                  </span>

                  <span style={{ fontSize: '0.85rem', color: theme.text, fontWeight: 600 }}>
                    {pedido.productos?.length || 0}
                    {prog.ajustes > 0 && (
                      <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: '0.72rem' }} title={`${prog.ajustes} con ajustes`}>⚠️</span>
                    )}
                  </span>

                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {conAjustesFila && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: theme.subtext, textDecoration: 'line-through' }}>
                        ${pedido.total.toLocaleString('es-AR')}
                      </span>
                    )}
                    <span style={{ fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      ${(conAjustesFila ? totalFinalFila : pedido.total).toLocaleString('es-AR')}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {pedidosFiltrados.map((pedido) => {
            const prog = progresoPedido(pedido);
            const enCurso = pedido.estado === 'pendiente' || pedido.estado === 'preparando';
            const totalFinalCard = calcularTotalFinal(pedido.total, prog.its);
            const conAjustes = prog.ajustes > 0 && totalFinalCard !== Number(pedido.total);
            return (
            <div 
              key={pedido.id} 
              style={{ 
                backgroundColor: theme.card, borderRadius: '20px', 
                border: `1px solid ${pedido.estado === 'pendiente' ? getStatusColor(pedido.estado) : theme.border}`, 
                padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', cursor: 'pointer', transition: 'all 0.2s', 
                boxShadow: pedido.estado === 'pendiente' ? `0 0 0 1px ${getStatusColor(pedido.estado)}20` : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}
              onClick={() => abrirPedido(pedido)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.backgroundColor = theme.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.backgroundColor = theme.card;
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: theme.subtext }}>#PED-{pedido.id.toString().padStart(4, '0')}</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: theme.text }}>{pedido.nombre}</h3>
                </div>
                <span style={{ 
                  padding: '6px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', 
                  backgroundColor: `${getStatusColor(pedido.estado)}15`, color: getStatusColor(pedido.estado), border: `1px solid ${getStatusColor(pedido.estado)}30`
                }}>
                  {getStatusLabel(pedido.estado)}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: theme.subtext, backgroundColor: theme.bg, padding: '12px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🕒 {formatearFecha(pedido.created_at)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {pedido.metodo_envio === 'envio' ? '🏍️' : '🏬'} <span style={{ fontWeight: 600 }}>{pedido.metodo_envio === 'envio' ? 'Envío a Domicilio' : 'Retira en Local'}</span>
                </div>
              </div>

              {/* Avance de preparación */}
              {enCurso && prog.total > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: theme.subtext }}>
                    <span>Preparados {prog.resueltos}/{prog.total}</span>
                    {prog.ajustes > 0 && <span style={{ color: '#f59e0b' }}>⚠️ {prog.ajustes} con ajustes</span>}
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', backgroundColor: theme.border, overflow: 'hidden' }}>
                    <div style={{ width: `${(prog.resueltos / prog.total) * 100}%`, height: '100%', backgroundColor: prog.resueltos === prog.total ? '#10b981' : theme.primary, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
              {!enCurso && prog.ajustes > 0 && (
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>⚠️ {prog.ajustes} {prog.ajustes === 1 ? 'producto con ajuste' : 'productos con ajustes'} en el envío</div>
              )}

              <div style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: theme.subtext, fontSize: '0.9rem', fontWeight: 600, backgroundColor: theme.bg, padding: '4px 10px', borderRadius: '8px' }}>
                  {pedido.productos?.length || 0} ítems
                </span>
                <span style={{ textAlign: 'right' }}>
                  {conAjustes && <span style={{ display: 'block', fontSize: '0.8rem', color: theme.subtext, textDecoration: 'line-through' }}>${pedido.total.toLocaleString('es-AR')}</span>}
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: theme.text }}>${(conAjustes ? totalFinalCard : pedido.total).toLocaleString('es-AR')}</span>
                </span>
              </div>

              {getVendedor(pedido) && (
                <div style={{ marginTop: '-6px', fontSize: '0.85rem', color: theme.subtext, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧑‍💼 <span>Vendedor: <strong style={{ color: theme.text }}>{getVendedor(pedido)}</strong></span>
                </div>
              )}
            </div>
          );})}
        </div>
      ))}

      {pedidoSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: theme.card, borderRadius: '28px', width: '100%', maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', border: `1px solid ${theme.border}`, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '30px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, backgroundColor: theme.card, zIndex: 10 }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '1.6rem', fontWeight: 900, color: theme.text, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  Pedido #{pedidoSeleccionado.id.toString().padStart(4, '0')}
                  <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', backgroundColor: `${getStatusColor(pedidoSeleccionado.estado)}15`, color: getStatusColor(pedidoSeleccionado.estado) }}>
                    {getStatusLabel(pedidoSeleccionado.estado)}
                  </span>
                </h2>
                <span style={{ color: theme.subtext, fontSize: '0.95rem' }}>{formatearFecha(pedidoSeleccionado.created_at)}</span>
                {getVendedor(pedidoSeleccionado) && (
                  <span style={{ color: theme.subtext, fontSize: '0.95rem', marginLeft: '12px' }}>· 🧑‍💼 Vendedor: <strong style={{ color: theme.text }}>{getVendedor(pedidoSeleccionado)}</strong></span>
                )}
              </div>
              <button onClick={cerrarDetalle} style={{ backgroundColor: theme.bg, border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: theme.subtext, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div style={{ backgroundColor: theme.bg, padding: '24px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
                <h4 style={{ margin: '0 0 16px 0', color: theme.text, fontSize: '1.1rem', fontWeight: 800 }}>👤 Datos del Cliente</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.95rem', color: theme.text }}>
                  <div><strong style={{ color: theme.subtext, fontSize: '0.8rem', display: 'block' }}>NOMBRE</strong> {pedidoSeleccionado.nombre}</div>
                  <div><strong style={{ color: theme.subtext, fontSize: '0.8rem', display: 'block' }}>TELÉFONO</strong> {pedidoSeleccionado.telefono}</div>
                  <div><strong style={{ color: theme.subtext, fontSize: '0.8rem', display: 'block' }}>ENTREGA</strong> {pedidoSeleccionado.metodo_envio === 'envio' ? 'A Domicilio 🏍️' : 'Retiro en Local 🏬'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: theme.subtext, fontSize: '0.8rem', display: 'block' }}>DIRECCIÓN</strong> {pedidoSeleccionado.metodo_envio === 'envio' ? pedidoSeleccionado.direccion : '-'}</div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => {
                      const ajustes = resumenAjustes(itemsTrabajo);
                      const aviso = ajustes.length ? `\n\nTe cuento que en tu pedido:\n- ${ajustes.join('\n- ')}\n\nTotal a abonar: $${totalFinalSel.toLocaleString('es-AR')}` : '';
                      const texto = `Hola ${pedidoSeleccionado.nombre}, te escribo de Distribuidora India por tu pedido...${aviso}`;
                      window.open(`https://wa.me/${pedidoSeleccionado.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
                    }}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#25d366', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    💬 WhatsApp
                  </button>
                  <button 
                    onClick={() => generarPDFAdmin(pedidoSeleccionado, itemsTrabajo, vendedorTrabajo.trim() || getVendedor(pedidoSeleccionado))}
                    style={{ flex: 1, padding: '12px', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    📄 Descargar PDF
                  </button>
                </div>
              </div>

              {/* VENDEDOR QUE PREPARA EL PEDIDO */}
              <div style={{ backgroundColor: theme.bg, padding: '20px 24px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
                <h4 style={{ margin: '0 0 12px 0', color: theme.text, fontSize: '1.1rem', fontWeight: 800 }}>🧑‍💼 Vendedor</h4>
                {editable ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      list="lista-vendedores"
                      type="text"
                      placeholder="¿Quién está preparando este pedido?"
                      value={vendedorTrabajo}
                      onChange={(e) => { setVendedorTrabajo(e.target.value); setHayCambios(true); }}
                      style={{ ...campo, flex: '1 1 240px', padding: '12px 14px', fontSize: '0.95rem' }}
                    />
                    {pedidoSeleccionado.estado === 'pendiente' && (
                      <button
                        onClick={() => guardarProgreso(true)}
                        disabled={guardando}
                        style={{ padding: '12px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 800, cursor: guardando ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
                      >
                        ▶ Tomar pedido
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ color: theme.text, fontWeight: 700, fontSize: '1rem' }}>
                    {getVendedor(pedidoSeleccionado) || <span style={{ color: theme.subtext, fontWeight: 500 }}>Sin vendedor registrado</span>}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', margin: '0 0 6px 0' }}>
                  <h4 style={{ margin: 0, color: theme.text, fontSize: '1.1rem', fontWeight: 800 }}>🛍️ Detalle del Pedido</h4>
                  {editable && (
                    <button onClick={marcarTodosListos} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #10b98155', backgroundColor: 'transparent', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem' }}>
                      ✅ Marcar todos como listos
                    </button>
                  )}
                </div>

                {editable && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '0.82rem', color: theme.subtext, marginBottom: '14px' }}>
                    <span style={{ fontWeight: 700 }}>Preparados {resueltosSel}/{itemsTrabajo.length}</span>
                    {ajustesSel > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠️ {ajustesSel} con ajustes</span>}
                    {hayCambios && <span style={{ color: '#3b82f6', fontWeight: 700 }}>● Cambios sin guardar</span>}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: editable ? 'none' : '360px', overflowY: editable ? 'visible' : 'auto' }}>
                  {itemsTrabajo.map((item, idx) => renderItem(item, idx, editable))}
                </div>

                {editable && (
                  <button
                    onClick={() => guardarProgreso()}
                    disabled={!hayCambios || guardando}
                    style={{ marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: hayCambios ? theme.primary : theme.border, color: hayCambios ? '#fff' : theme.subtext, fontWeight: 900, cursor: hayCambios && !guardando ? 'pointer' : 'not-allowed', fontSize: '0.95rem' }}
                  >
                    {guardando ? 'Guardando…' : hayCambios ? '💾 Guardar progreso del pedido' : '✓ Progreso guardado'}
                  </button>
                )}
                
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `2px dashed ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {totalFinalSel !== totalOriginalSel && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: theme.subtext, fontSize: '0.95rem', fontWeight: 600 }}>
                      <span>Total del pedido original:</span>
                      <span style={{ textDecoration: 'line-through' }}>${totalOriginalSel.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: theme.subtext }}>{totalFinalSel !== totalOriginalSel ? 'TOTAL A ENVIAR:' : 'TOTAL:'}</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 900, color: theme.primary }}>${totalFinalSel.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: theme.text, fontSize: '1.1rem', fontWeight: 800 }}>Actualizar Estado</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  {['pendiente', 'preparando', 'completado', 'cancelado'].map((est) => (
                    <button 
                      key={est}
                      onClick={() => actualizarEstadoDirecto(pedidoSeleccionado.id, est)}
                      style={{ 
                        padding: '14px', borderRadius: '12px', 
                        border: `2px solid ${pedidoSeleccionado.estado === est ? getStatusColor(est) : theme.border}`, 
                        backgroundColor: pedidoSeleccionado.estado === est ? `${getStatusColor(est)}10` : theme.bg, 
                        color: pedidoSeleccionado.estado === est ? getStatusColor(est) : theme.subtext, 
                        fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      {pedidoSeleccionado.estado === est && <span>✓</span>}
                      {getStatusLabel(est).substring(2)}
                    </button>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                   <button 
                    onClick={() => eliminarPedido(pedidoSeleccionado.id)} 
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                   >
                     <span>🗑️</span> Eliminar pedido permanentemente
                   </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {mostrarModalPago && pedidoACompletar && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: theme.card, borderRadius: '24px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', padding: '30px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
            <h3 style={{ margin: 0, color: theme.text, fontSize: '1.4rem', fontWeight: 900 }}>💳 Método de Cobro del Pedido</h3>

            {/* Resumen de lo que realmente se envía */}
            <div style={{ padding: '14px 16px', borderRadius: '14px', backgroundColor: theme.innerBox, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: theme.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: theme.subtext }}>Total del pedido original</span>
                <span style={{ textDecoration: totalFinalCobro !== Number(pedidoACompletar.total) ? 'line-through' : 'none' }}>${Number(pedidoACompletar.total).toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem' }}>
                <span>Total a cobrar (lo enviado)</span>
                <span style={{ color: '#10b981' }}>${totalFinalCobro.toLocaleString('es-AR')}</span>
              </div>

              {ajustesCobro.length > 0 && (
                <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: `1px dashed ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '0.78rem', color: '#f59e0b' }}>⚠️ AJUSTES DEL ENVÍO</strong>
                  {resumenAjustes(itemsACompletar).map((l, i) => <span key={i} style={{ color: theme.subtext }}>• {l}</span>)}
                </div>
              )}

              {sinStockCobro.length > 0 && (
                <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: `1px dashed ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '0.78rem', color: '#f59e0b' }}>🚫 SE MARCARÁN COMO SIN STOCK</strong>
                  {sinStockCobro.map((it, i) => <span key={i} style={{ color: theme.subtext }}>• {nombreItem(it)}</span>)}
                </div>
              )}

              {sinPrepararCobro.length > 0 && (
                <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: `1px dashed ${theme.border}`, color: theme.subtext }}>
                  ℹ️ {sinPrepararCobro.length} {sinPrepararCobro.length === 1 ? 'producto no fue marcado como listo' : 'productos no fueron marcados como listos'}: se envían completos.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.subtext }}>🧑‍💼 VENDEDOR QUE PREPARÓ EL PEDIDO:</label>
              <input
                list="lista-vendedores"
                type="text"
                placeholder="Nombre del vendedor"
                value={vendedorCobro}
                onChange={(e) => setVendedorCobro(e.target.value)}
                style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${vendedorCobro.trim() ? theme.border : '#f59e0b'}`, backgroundColor: theme.innerBox, color: theme.text, fontWeight: 'bold', outline: 'none' }}
              />
            </div>

            <p style={{ margin: 0, color: theme.subtext, fontSize: '0.95rem' }}>
              Seleccioná cómo abonó el cliente <strong>{pedidoACompletar.nombre}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(['Efectivo', 'Transferencia', 'Cuenta Corriente'] as const).map((metodo) => (
                <label 
                  key={metodo}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', 
                    backgroundColor: metodoPagoSeleccionado === metodo ? 'rgba(59, 130, 246, 0.15)' : theme.innerBox,
                    border: `2px solid ${metodoPagoSeleccionado === metodo ? theme.primary : theme.border}`,
                    cursor: 'pointer', fontWeight: 'bold', color: theme.text, fontSize: '1rem'
                  }}
                >
                  <input 
                    type="radio" 
                    name="metodoPagoWeb" 
                    checked={metodoPagoSeleccionado === metodo} 
                    onChange={() => setMetodoPagoSeleccionado(metodo)}
                    style={{ width: '18px', height: '18px', accentColor: theme.primary }}
                  />
                  {metodo === 'Efectivo' && '💵 Efectivo (Suma a Caja Física)'}
                  {metodo === 'Transferencia' && '📲 Transferencia (Suma a Banco)'}
                  {metodo === 'Cuenta Corriente' && '📝 Asignar a Cuenta Corriente (Deuda)'}
                </label>
              ))}
            </div>

            {metodoPagoSeleccionado === 'Cuenta Corriente' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.subtext }}>SELECCIONAR CUENTA CORRIENTE / CLIENTE:</label>
                <select 
                  value={clienteIdSeleccionado} 
                  onChange={(e) => setClienteIdSeleccionado(e.target.value)}
                  style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.innerBox, color: theme.text, fontWeight: 'bold', outline: 'none' }}
                >
                  <option value="" disabled>-- Seleccioná un cliente --</option>
                  {clientesLista.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      👤 {cli.nombre} (Saldo actual: ${Number(cli.saldo_cc || 0).toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button 
                onClick={() => setMostrarModalPago(false)} 
                disabled={procesandoPago}
                style={{ flex: 1, padding: '14px', backgroundColor: theme.innerBox, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarCompletarPedidoConPago} 
                disabled={procesandoPago}
                style={{ flex: 1, padding: '14px', backgroundColor: procesandoPago ? '#64748b' : '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: procesandoPago ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
              >
                {procesandoPago ? 'Procesando…' : 'Confirmar y Completar'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}