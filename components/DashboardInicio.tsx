"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../app/supabase';
import { crearTema } from '../lib/theme';
import { Cargando } from './ui/Piezas';
import { Icono } from './Icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// =============================================================================
// Inicio / Dashboard
// -----------------------------------------------------------------------------
// Criterio de esta pantalla: mostrar DATOS REALES y, cuando un número es
// estimado, decirlo explícitamente. Antes la "ganancia" de las ventas sin
// detalle de ítems se inventaba con un 35% fijo, lo que hacía que el número
// pareciera una medición cuando en realidad era una suposición.
// =============================================================================

type SerieDia = {
  clave: string;
  fecha: string;
  Total: number;
  Ganancia: number;
  BaseGanancia: number;
  SinDetalle: number;
  Ventas: number;
};

type MetricasType = {
  cajaHoy: number;
  gananciaHoy: number;
  baseGananciaHoy: number;
  ventasHoy: number;
  ventasHoySinDetalle: number;
  totalCalle: number;
  clientes: number;
  clientesConDeuda: number;
  totalProductos: number;
  productosConVariedades: number;
  totalVariedades: number;
  itemsVendibles: number;
  productosDisponibles: number;
  productosAgotados: number;
  valorInventarioCosto: number;
  pedidosPendientes: number;
  cajaSinCerrar: boolean;
  graficoSemana: SerieDia[];
  graficoMeses: SerieDia[];
};

const METRICAS_VACIAS: MetricasType = {
  cajaHoy: 0, gananciaHoy: 0, baseGananciaHoy: 0, ventasHoy: 0, ventasHoySinDetalle: 0,
  totalCalle: 0, clientes: 0, clientesConDeuda: 0,
  totalProductos: 0, productosConVariedades: 0, totalVariedades: 0, itemsVendibles: 0,
  productosDisponibles: 0, productosAgotados: 0, valorInventarioCosto: 0,
  pedidosPendientes: 0, cajaSinCerrar: false,
  graficoSemana: [], graficoMeses: []
};

export default function DashboardInicio({
  darkMode = true,
  onNavegar
}: { darkMode?: boolean; onNavegar?: (tab: string) => void }) {
  const [metricas, setMetricas] = useState<MetricasType>(METRICAS_VACIAS);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const theme = crearTema(darkMode);

  const cargarMetricasYBalances = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // 1. Precios vivos + estado real de stock (incluye variedades: cada
      //    variedad es un ítem vendible con código y precio propios).
      const { data: stockItems, count: conteoStock } = await supabase
        .from('stock')
        .select('nombre, precio_costo, precio_minorista, precio_mayorista, sin_stock, variedades', { count: 'exact' });

      const mapaPrecios = new Map<string, { costo: number; venta: number }>();
      let totalProductos = conteoStock ?? 0;
      let productosAgotados = 0;
      let productosConVariedades = 0;
      let totalVariedades = 0;
      let valorInventarioCosto = 0;

      if (stockItems) {
        totalProductos = conteoStock ?? stockItems.length;
        stockItems.forEach((item: any) => {
          if (item.nombre) {
            mapaPrecios.set(item.nombre.trim().toLowerCase(), {
              costo: Number(item.precio_costo) || 0,
              venta: Number(item.precio_minorista || item.precio_mayorista) || 0
            });
          }
          if (item.sin_stock) productosAgotados++;

          const variedades = Array.isArray(item.variedades) ? item.variedades : [];
          const conNombre = variedades.filter((v: any) => v && String(v.nombre || '').trim());
          if (conNombre.length > 0) {
            productosConVariedades++;
            totalVariedades += conNombre.length;
            conNombre.forEach((v: any) => {
              valorInventarioCosto += Number(v.precio_costo) || 0;
            });
          } else {
            valorInventarioCosto += Number(item.precio_costo) || 0;
          }
        });
      }

      // Ítems realmente vendibles: productos simples + todas sus variedades.
      const itemsVendibles = Math.max(0, totalProductos - productosConVariedades) + totalVariedades;

      // 2. Ventas completadas
      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('estado', 'completada');

      const ventasValidas = ventas || [];
      const hoy = new Date();
      const esMismoDia = (a: Date, b: Date) =>
        a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

      const obtenerFechaVenta = (v: any) => {
        if (v.created_at) return new Date(v.created_at);
        if (v.id && !isNaN(Number(v.id)) && String(v.id).length > 10) return new Date(Number(v.id));
        if (v.fecha) {
          const partes = String(v.fecha).split(/[\/\s,:]+/);
          if (partes.length >= 3) {
            return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
          }
        }
        return null;
      };

      /**
       * Calcula caja y ganancia de un conjunto de ventas.
       * - `BaseGanancia` es el monto sobre el que la ganancia sí es calculable
       *   (ventas con detalle de ítems y costo conocido).
       * - `SinDetalle` es el monto que NO se puede|DE|_DE| evaluar sin inventar
       *   un margen: se muestra aparte en vez de disimularlo.
       */
      const resumirVentas = (lista: any[]) => {
        let total = 0;
        let base = 0;
        let costo = 0;
        let sinDetalle = 0;
        let ventasSinDetalle = 0;

        lista.forEach((venta: any) => {
          const neto = Number(venta.total || 0);
          total += neto;

          if (Array.isArray(venta.items) && venta.items.length > 0) {
            let costoVenta = 0;
            venta.items.forEach((item: any) => {
              const clave = item.nombre ? item.nombre.trim().toLowerCase() : '';
              const costoUnitario = Number(item.precio_costo) || mapaPrecios.get(clave)?.costo || 0;
              costoVenta += costoUnitario * (Number(item.unidades || 1));
            });
            base += neto;
            costo += costoVenta;
          } else {
            sinDetalle += neto;
            ventasSinDetalle++;
          }
        });

        return { total, base, ganancia: Math.max(0, base - costo), sinDetalle, ventasSinDetalle, cantidad: lista.length };
      };

      const ventasDeHoy = ventasValidas.filter((v: any) => {
        const fv = obtenerFechaVenta(v);
        return fv && !isNaN(fv.getTime()) && esMismoDia(fv, hoy);
      });
      const resumenHoy = resumirVentas(ventasDeHoy);

      // 3. Clientes (deuda en calle)
      const { data: clientes } = await supabase.from('clientes').select('saldo_cc');
      const totalCalle = clientes ? clientes.reduce((acc: number, c: any) => acc + (Number(c.saldo_cc) || 0), 0) : 0;
      const clientesConDeuda = clientes ? clientes.filter((c: any) => (Number(c.saldo_cc) || 0) > 0).length : 0;

      // 4. Pedidos web pendientes y estado del cierre de caja
      const { data: ordenes } = await supabase.from('ordenes').select('id, estado');
      const pedidosPendientes = ordenes
        ? ordenes.filter((o: any) => !['entregado', 'completado', 'cancelado'].includes(String(o.estado || '').toLowerCase())).length
        : 0;

      const hoyStr = hoy.toLocaleDateString('es-AR');
      const { data: cierres } = await supabase
        .from('cierres_caja')
        .select('fecha_cierre')
        .ilike('fecha_cierre', `%${hoyStr}%`)
        .limit(1);
      const cajaSinCerrar = !cierres || cierres.length === 0;

      // 5. Gráfico semanal (últimos 7 días)
      const graficoSemana: SerieDia[] = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const lista = ventasValidas.filter((v: any) => {
          const fv = obtenerFechaVenta(v);
          return fv && esMismoDia(fv, d);
        });
        const r = resumirVentas(lista);
        return {
          clave: d.toISOString().slice(0, 10),
          fecha: `${d.getDate()}/${d.getMonth() + 1}`,
          Total: r.total, Ganancia: r.ganancia, BaseGanancia: r.base,
          SinDetalle: r.sinDetalle, Ventas: r.cantidad
        };
      });

      // 6. Gráfico mensual (últimos 6 meses)
      const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const graficoMeses: SerieDia[] = [...Array(6)].map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const lista = ventasValidas.filter((v: any) => {
          const fv = obtenerFechaVenta(v);
          return fv && fv.getMonth() === d.getMonth() && fv.getFullYear() === d.getFullYear();
        });
        const r = resumirVentas(lista);
        return {
          clave: `${d.getFullYear()}-${d.getMonth()}`,
          fecha: `${nombresMeses[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
          Total: r.total, Ganancia: r.ganancia, BaseGanancia: r.base,
          SinDetalle: r.sinDetalle, Ventas: r.cantidad
        };
      });

      setMetricas({
        cajaHoy: resumenHoy.total,
        gananciaHoy: resumenHoy.ganancia,
        baseGananciaHoy: resumenHoy.base,
        ventasHoy: resumenHoy.cantidad,
        ventasHoySinDetalle: resumenHoy.ventasSinDetalle,
        totalCalle, clientes: clientes ? clientes.length : 0, clientesConDeuda,
        totalProductos, productosConVariedades, totalVariedades, itemsVendibles,
        productosDisponibles: totalProductos - productosAgotados,
        productosAgotados, valorInventarioCosto,
        pedidosPendientes, cajaSinCerrar,
        graficoSemana, graficoMeses
      });
      setActualizado(new Date());
    } catch (error) {
      console.error("Error al estructurar las métricas avanzadas:", error);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => { cargarMetricasYBalances(); }, []);

  // Tiempo real: cualquier venta refresca los montos
  useEffect(() => {
    const canal = supabase
      .channel('realtime-dashboard-ventas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => cargarMetricasYBalances(true))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  // ---------------------------------------------------------------------
  // Piezas visuales
  // ---------------------------------------------------------------------

  const pesos = (valor: number) => `$${Number(valor || 0).toLocaleString('es-AR')}`;

  const tarjeta = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    backgroundColor: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: theme.shadowCard,
    ...extra
  });

  const Kpi = ({
    etiqueta, valor, detalle, color, icono
  }: { etiqueta: string; valor: string; detalle?: string; color: string; icono?: React.ReactNode }) => (
    <div style={tarjeta({ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `3px solid ${color}` })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icono && <span style={{ color }}>{icono}</span>}
        <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.subtext }}>{etiqueta}</span>
      </div>
      <span style={{ fontSize: '1.7rem', fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.1 }}>
        {valor}
      </span>
      {detalle && <span style={{ fontSize: '0.78rem', color: theme.subtext }}>{detalle}</span>}
    </div>
  );

  const pendiente = (titulo: string, detalle: string, tab: string, color: string, Ico: any) => (
    <button
      onClick={() => onNavegar?.(tab)}
      disabled={!onNavegar}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '13px 14px', borderRadius: 14, cursor: onNavegar ? 'pointer' : 'default',
        background: theme.innerBox, border: `1px solid ${theme.border}`, color: theme.text
      }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color, background: `${color}22`
      }}>
        <Ico size={17} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem' }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: theme.subtext }}>{detalle}</span>
      </span>
    </button>
  );

  const coberturaHoy = metricas.cajaHoy > 0 ? Math.round((metricas.baseGananciaHoy / metricas.cajaHoy) * 100) : 100;

  const tareas = useMemo(() => [
    { activo: metricas.pedidosPendientes > 0, titulo: `${metricas.pedidosPendientes} pedido(s) web sin resolver`, detalle: 'Revisar, preparar y cobrar', tab: 'pedidos_web', color: theme.warning, Ico: Icono.Pedidos },
    { activo: metricas.productosAgotados > 0, titulo: `${metricas.productosAgotados} producto(s) agotados`, detalle: 'No aparecen en la web ni en el catálogo', tab: 'stock', color: theme.danger, Ico: Icono.Inventario },
    { activo: metricas.clientesConDeuda > 0, titulo: `${metricas.clientesConDeuda} cliente(s) con deuda`, detalle: `Total a cobrar: ${pesos(metricas.totalCalle)}`, tab: 'clientes', color: theme.info, Ico: Icono.CuentaCorriente },
    { activo: metricas.cajaSinCerrar, titulo: 'La caja de hoy no está cerrada', detalle: 'Hacé el cierre antes de que termine el día', tab: 'caja', color: theme.accent, Ico: Icono.Caja }
  ].filter((t) => t.activo), [metricas, theme]);

  if (cargando) {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
          <Cargando filas={1} alto={110} darkMode={darkMode} />
          <Cargando filas={1} alto={110} darkMode={darkMode} />
          <Cargando filas={1} alto={110} darkMode={darkMode} />
          <Cargando filas={1} alto={110} darkMode={darkMode} />
        </div>
        <Cargando filas={4} alto={80} darkMode={darkMode} />
      </div>
    );
  }

  const graficoTooltip = {
    contentStyle: {
      backgroundColor: theme.card, borderRadius: 12,
      border: `1px solid ${theme.border}`, color: theme.text, fontSize: '0.8rem'
    },
    labelStyle: { color: theme.text, fontWeight: 700, marginBottom: 4 },
    formatter: (valor: any, nombre: any, item: any) => {
      const punto = item?.payload;
      if (nombre === 'Ganancia (detalle)') {
        const cobertura = punto?.BaseGanancia > 0 ? Math.round((punto.BaseGanancia / punto.Total) * 100) : 100;
        return [`${pesos(valor)} (cubre el ${cobertura}% de la caja)`, 'Ganancia (detalle)'];
      }
      return [pesos(valor), nombre];
    }
  };

  const ejeStyle = { fontSize: 11, fill: theme.subtext };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ---------- Encabezado ---------- */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: theme.text }}>Resumen del negocio</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: theme.subtext }}>
            Datos reales del sistema
            {actualizado && <> · actualizado a las {actualizado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>}
          </p>
        </div>
        <button
          onClick={() => { setRefrescando(true); cargarMetricasYBalances(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11,
            border: `1px solid ${theme.border}`, background: theme.card, color: theme.text,
            fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', minHeight: 42
          }}
        >
          <Icono.Refrescar size={15} />
          {refrescando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* ---------- Indicadores ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Kpi
          etiqueta="Caja de hoy"
          valor={pesos(metricas.cajaHoy)}
          detalle={`${metricas.ventasHoy} venta(s) del día`}
          color={theme.success}
          icono={<Icono.Precio size={16} />}
        />
        <Kpi
          etiqueta="Ganancia del día"
          valor={pesos(metricas.gananciaHoy)}
          detalle={metricas.ventasHoySinDetalle > 0
            ? `Cubre el ${coberturaHoy}% de la caja`
            : 'Calculada sobre el detalle de ítems'}
          color={theme.info}
          icono={<Icono.Grafico size={16} />}
        />
        <Kpi
          etiqueta="Total a cobrar"
          valor={pesos(metricas.totalCalle)}
          detalle={`${metricas.clientesConDeuda} de ${metricas.clientes} cliente(s)`}
          color={theme.danger}
          icono={<Icono.CuentaCorriente size={16} />}
        />
        <Kpi
          etiqueta="Artículos cargados"
          valor={metricas.itemsVendibles.toLocaleString('es-AR')}
          detalle={`${metricas.totalProductos.toLocaleString('es-AR')} productos · ${metricas.totalVariedades.toLocaleString('es-AR')} variedades`}
          color={theme.mayorista}
          icono={<Icono.Inventario size={16} />}
        />
      </div>

      {/* ---------- Inventario + tareas ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Stock real */}
        <div style={tarjeta({ display: 'flex', flexDirection: 'column', gap: 14 })}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.text }}>Stock real de productos</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: theme.subtext }}>Lo que hay cargado hoy en el sistema</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1 }}>
              {metricas.itemsVendibles.toLocaleString('es-AR')}
            </span>
            <span style={{ fontSize: '0.85rem', color: theme.subtext }}>
              artículos para vender
              {metricas.totalVariedades > 0 && (
                <> <strong style={{ color: theme.text }}>({metricas.totalVariedades.toLocaleString('es-AR')} son variedades)</strong></>
              )}
            </span>
          </div>

          {/* Desglose: por qué el total de artículos no es igual al de filas */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
            padding: 12, borderRadius: 12, background: theme.innerBox
          }}>
            <div>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.subtext }}>Productos</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {metricas.totalProductos.toLocaleString('es-AR')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.subtext }}>Con variedades</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {metricas.productosConVariedades.toLocaleString('es-AR')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.66rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.subtext }}>Variedades</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {metricas.totalVariedades.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <div style={{ height: 10, borderRadius: 999, background: theme.innerBox, overflow: 'hidden', display: 'flex' }} title="Disponibilidad de los productos cargados (un producto con variedades cuenta una sola vez)">
            <div style={{ width: `${metricas.totalProductos ? (metricas.productosDisponibles / metricas.totalProductos) * 100 : 0}%`, background: theme.success }} />
            <div style={{ width: `${metricas.totalProductos ? (metricas.productosAgotados / metricas.totalProductos) * 100 : 0}%`, background: theme.danger }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: theme.subtext }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: theme.success }} />
              <strong style={{ color: theme.text }}>{metricas.productosDisponibles.toLocaleString('es-AR')}</strong> disponibles
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: theme.subtext }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: theme.danger }} />
              <strong style={{ color: theme.text }}>{metricas.productosAgotados.toLocaleString('es-AR')}</strong> agotados
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.74rem', color: theme.subtext }}>
            Disponibilidad calculada sobre {metricas.totalProductos.toLocaleString('es-AR')} productos: un producto con
            {' '}{metricas.productosConVariedades.toLocaleString('es-AR')} variedades cuenta una sola vez.
          </p>

          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: theme.subtext }}>Inversión cargada a costo</span>
            <strong style={{ fontSize: '1.05rem', color: theme.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {pesos(metricas.valorInventarioCosto)}
            </strong>
          </div>
        </div>

        {/* Pendientes del día */}
        <div style={tarjeta({ display: 'flex', flexDirection: 'column', gap: 12 })}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: theme.text }}>Qué hay que hacer hoy</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: theme.subtext }}>
              {tareas.length === 0 ? 'Todo al día' : `${tareas.length} pendiente(s)`}
            </p>
          </div>

          {tareas.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 14px', borderRadius: 14, background: theme.innerBox, color: theme.success, fontWeight: 700 }}>
              <Icono.Confirmar size={20} />
              No hay nada pendiente. Todo en orden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tareas.map((t) => pendiente(t.titulo, t.detalle, t.tab, t.color, t.Ico))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Gráficos ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
        {[
          { titulo: 'Últimos 7 días', datos: metricas.graficoSemana, clave: 'fecha' },
          { titulo: 'Últimos 6 meses', datos: metricas.graficoMeses, clave: 'fecha' }
        ].map((g) => (
          <div key={g.titulo} style={tarjeta({ height: 340, display: 'flex', flexDirection: 'column' })}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: theme.text }}>{g.titulo}</h3>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: theme.subtext }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: theme.accent }} /> Caja
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: theme.success }} /> Ganancia
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={g.datos} barGap={4} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey={g.clave} stroke={theme.subtext} tick={ejeStyle} tickLine={false} axisLine={{ stroke: theme.border }} />
                  <YAxis stroke={theme.subtext} tick={ejeStyle} tickLine={false} axisLine={false} width={58}
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip {...graficoTooltip} cursor={{ fill: theme.hover }} />
                  <Bar dataKey="Total" fill={theme.accent} radius={[6, 6, 0, 0]} name="Caja" maxBarSize={34} />
                  <Bar dataKey="Ganancia" fill={theme.success} radius={[6, 6, 0, 0]} name="Ganancia (detalle)" maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Nota de transparencia ---------- */}
      {metricas.ventasHoySinDetalle > 0 && (
        <div style={{
          display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px 15px', borderRadius: 14,
          background: theme.innerBox, border: `1px solid ${theme.border}`,
          fontSize: '0.82rem', color: theme.subtext, lineHeight: 1.5
        }}>
          <span style={{ color: theme.warning, flexShrink: 0 }}><Icono.Info size={17} /></span>
          <span>
            <strong style={{ color: theme.text }}>Cómo leer la ganancia:</strong> se calcula únicamente sobre las ventas
            que guardaron el detalle de los ítems vendidos ({pesos(metricas.baseGananciaHoy)} de los {pesos(metricas.cajaHoy)} del día).
            Las {metricas.ventasHoySinDetalle} venta(s) sin detalle ({pesos(metricas.cajaHoy - metricas.baseGananciaHoy)}) se muestran
            en la caja pero no se estiman como ganancia, para no inventar un número.
          </span>
        </div>
      )}
    </div>
  );
}