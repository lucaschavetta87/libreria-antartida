"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../app/supabase';
import { useToast } from './ui/Avisos';

interface CierreCajaProps {
  darkMode?: boolean;
}

export default function CierreCaja({ darkMode = true }: CierreCajaProps) {
  const toast = useToast();
  const { confirmar } = toast;
  const [ventasDia, setVentasDia] = useState<any[]>([]);
  const [preciosStockMap, setPreciosStockMap] = useState<Map<string, { costo: number; venta: number }>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [verHistorialCierres, setVerHistorialCierres] = useState(false);
  const [historialCierres, setHistorialCierres] = useState<any[]>([]);
  const [cierreSeleccionado, setCierreSeleccionado] = useState<any | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 15;
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const cierresPorPagina = 10;

  const [isMobile, setIsMobile] = useState(false);

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
    innerBox: darkMode ? '#0f172a' : '#f1f5f9',
    divider: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.card,
    padding: isMobile ? '22px 16px' : '28px',
    borderRadius: '24px',
    border: `1px solid ${theme.border}`,
    boxShadow: darkMode ? '0 10px 25px -5px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.05)',
    width: '100%',
    transition: 'all 0.3s'
  };

  const hoyStr = useMemo(() => new Date().toLocaleDateString('es-AR'), []);

  // Carga inicial de datos y costos de stock
  const cargarDatosCaja = async () => {
    try {
      const { data: stockItems } = await supabase
        .from('stock')
        .select('nombre, precio_costo, precio_venta');
      
      const mapaPrecios = new Map<string, { costo: number; venta: number }>();
      if (stockItems) {
        stockItems.forEach((item: any) => {
          if (item.nombre) {
            mapaPrecios.set(item.nombre.trim().toLowerCase(), {
              costo: Number(item.precio_costo) || 0,
              venta: Number(item.precio_venta) || 0
            });
          }
        });
      }
      setPreciosStockMap(mapaPrecios);

      const { data: cierresHoy } = await supabase
        .from('cierres_caja')
        .select('created_at')
        .ilike('fecha_cierre', `%${hoyStr}%`);

      const primerCierreHoy = cierresHoy && cierresHoy.length > 0 ? cierresHoy[0].created_at : null;

      const { data: ventasFetch, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('estado', 'completada');

      if (!error && ventasFetch) {
        const hoy = new Date();
        let filtradas = ventasFetch.filter((v: any) => {
          // Filtrado robusto basado en fecha (timestamp de id o created_at)
          const fechaVenta = v.created_at ? new Date(v.created_at) : (v.id ? new Date(Number(v.id)) : null);
          if (!fechaVenta || isNaN(fechaVenta.getTime())) return false;

          const esMismoDia = 
            fechaVenta.getDate() === hoy.getDate() &&
            fechaVenta.getMonth() === hoy.getMonth() &&
            fechaVenta.getFullYear() === hoy.getFullYear();

          return esMismoDia;
        });

        if (primerCierreHoy) {
          filtradas = filtradas.filter((v: any) => new Date(v.created_at || v.id).getTime() > new Date(primerCierreHoy).getTime());
        }
        setVentasDia(filtradas);
      }
    } catch (err) {
      console.error("Error cargando datos de caja:", err);
    } finally {
      setCargando(false);
    }
  };

  const cargarHistorialCierres = async () => {
    const { data, error } = await supabase
      .from('cierres_caja')
      .select('*')
      .order('id', { ascending: false });
    if (!error && data) setHistorialCierres(data);
  };

  useEffect(() => {
    cargarDatosCaja();
    cargarHistorialCierres();
  }, [hoyStr]);

  // Suscripción en tiempo real para reflejar nuevas ventas al instante
  useEffect(() => {
    const canalVentas = supabase
      .channel('cambios-ventas-caja')
      .on('postgres_changes', { event: '*', filter: 'estado=eq.completada', schema: 'public', table: 'ventas' }, () => {
        cargarDatosCaja();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVentas);
    };
  }, []);

  // --- LÓGICA DE PROCESAMIENTO Y CÁLCULO DE GANANCIAS RESTANDO COSTOS ---
  const balances = useMemo(() => {
    let totalGeneralVendido = 0;
    let costoTotalGeneral = 0;

    const inicializarMetodos = () => ({
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      cuenta_corriente: 0,
      detalles_cc: [] as { cliente: string; monto: number }[]
    });

    const m = {
      mayorista: { total: 0, costo: 0, ...inicializarMetodos() },
      minorista: { total: 0, costo: 0, ...inicializarMetodos() }
    };

    ventasDia.forEach((venta) => {
      // Discriminación robusta: Es mayorista si tiene cliente_id válido, nombre distinto a mostrador o tag explícito
      const esMayorista = Boolean(
        venta.tipo?.toLowerCase() === 'mayorista' || 
        venta.es_mayorista ||
        (venta.cliente_id !== null && venta.cliente_id !== undefined && venta.cliente_id !== '') || 
        (venta.cliente_nombre && venta.cliente_nombre !== 'Venta Minorista Mostrador')
      );

      const tipoVenta: 'mayorista' | 'minorista' = esMayorista ? 'mayorista' : 'minorista';

      const netoVenta = Number(venta.total || 0);
      let costoVentaCalculado = 0;

      if (Array.isArray(venta.items)) {
        venta.items.forEach((item: any) => {
          const nombreClave = item.nombre ? item.nombre.trim().toLowerCase() : '';
          const preciosActuales = preciosStockMap.get(nombreClave);
          
          // Toma rigurosamente el precio de costo registrado en Supabase (o el ítem)
          const costoUnitario = Number(item.precio_costo) || Number(preciosActuales?.costo) || 0;
          const unidades = Number(item.unidades || 1);
          costoVentaCalculado += (costoUnitario * unidades);
        });
      } else {
        costoVentaCalculado = netoVenta * 0.65; // Resguardo estándar si faltan ítems
      }

      totalGeneralVendido += netoVenta;
      costoTotalGeneral += costoVentaCalculado;

      m[tipoVenta].total += netoVenta;
      m[tipoVenta].costo += costoVentaCalculado;

      const metodo = venta.metodo_pago?.toLowerCase() || 'efectivo';
      const clienteName = venta.cliente_nombre || venta.cliente || "Cliente No Registrado";

      if (metodo.includes('efectivo')) {
        m[tipoVenta].efectivo += netoVenta;
      } else if (metodo.includes('transferencia')) {
        m[tipoVenta].transferencia += netoVenta;
      } else if (metodo.includes('tarjeta')) {
        m[tipoVenta].tarjeta += netoVenta;
      } else if (metodo.includes('cuenta') || metodo.includes('cta cte')) {
        m[tipoVenta].cuenta_corriente += netoVenta;
        m[tipoVenta].detalles_cc.push({ cliente: clienteName, monto: netoVenta });
      } else {
        m[tipoVenta].efectivo += netoVenta;
      }
    });

    return {
      totalGeneral: totalGeneralVendido,
      gananciaNetaGeneral: Math.max(0, totalGeneralVendido - costoTotalGeneral),
      desglose: m
    };
  }, [ventasDia, preciosStockMap]);

  const ejecutarCierreDeCaja = async () => {
    if (ventasDia.length === 0) {
      return toast.avisar("No existen operaciones registradas en la jornada actual para procesar un cierre fiscal.", 'alerta');
    }

    const mensajeConfirmacion = 
      `🚨 BALANCE DE CIERRE PREVISTO:\n\n` +
      `• Efectivo esperado en Caja Física: $${(balances.desglose.minorista.efectivo + balances.desglose.mayorista.efectivo).toLocaleString('es-AR')}\n` +
      `• Transferencias esperadas en Banco: $${(balances.desglose.minorista.transferencia + balances.desglose.mayorista.transferencia).toLocaleString('es-AR')}\n\n` +
      `¿Desea asentar el cierre de caja y archivar el historial en la base de datos?`;

    if (!(await confirmar({ titulo: 'Cerrar la caja', mensaje: mensajeConfirmacion.split('\n').filter(Boolean).slice(-1)[0], textoOk: 'Sí, cerrar caja' }))) return;

    try {
      const nuevoCierre = {
        fecha_cierre: `${hoyStr} - ${new Date().toLocaleTimeString('es-AR').slice(0, 5)}hs`,
        total_facturado: balances.totalGeneral,
        ganancia_neta: balances.gananciaNetaGeneral,
        detalles_json: JSON.stringify({
          mayorista: balances.desglose.mayorista,
          minorista: balances.desglose.minorista,
          total_ventas_auditadas: ventasDia.length
        })
      };

      const { error } = await supabase.from('cierres_caja').insert([nuevoCierre]);
      if (error) throw error;

      toast.exito("Cierre de caja guardado con éxito. Los valores han sido archivados.");
      setVentasDia([]);
      await cargarHistorialCierres();
    } catch (err: any) {
      toast.error("Error crítico al procesar cierre: " + err.message);
    }
  };

  const renderFilaDesglose = (titulo: string, datos: any, colorBadge: string) => (
    <div style={{ backgroundColor: theme.innerBox, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: '800', color: colorBadge }}>{titulo}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '1.25rem', color: theme.text }}>
          ${datos.total.toLocaleString('es-AR')}
        </span>
      </div>
      <div style={{ fontSize: '0.88rem', color: '#10b981', fontWeight: '700' }}>
        Ganancia Neta Calculada (Venta - Costo Stock): +${Math.max(0, datos.total - datos.costo).toLocaleString('es-AR')}
      </div>
      <hr style={{ border: 'none', borderTop: `1px solid ${theme.divider}`, margin: '4px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '10px', fontSize: '0.9rem' }}>
        <div>💵 Ef: <strong>${datos.efectivo.toLocaleString('es-AR')}</strong></div>
        <div>📲 Trans: <strong>${datos.transferencia.toLocaleString('es-AR')}</strong></div>
        <div>💳 Tarj: <strong>${datos.tarjeta.toLocaleString('es-AR')}</strong></div>
        <div>📝 Cta Cte: <strong style={{ color: datos.cuenta_corriente > 0 ? '#f59e0b' : theme.text }}>${datos.cuenta_corriente.toLocaleString('es-AR')}</strong></div>
      </div>
      {datos.detalles_cc.length > 0 && (
        <div style={{ backgroundColor: darkMode ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.1)', padding: '10px', borderRadius: '8px', marginTop: '6px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#d97706', marginBottom: '4px' }}>Deudores en Cuenta Corriente:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem' }}>
            {datos.detalles_cc.map((item: any, idx: number) => (
              <span key={idx} style={{ backgroundColor: theme.card, padding: '3px 8px', borderRadius: '5px', border: `1px solid ${theme.border}` }}>
                👤 {item.cliente}: <strong>${item.monto.toLocaleString('es-AR')}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const totalPaginas = Math.ceil(ventasDia.length / itemsPorPagina);
  const ventasPaginaActual = useMemo(() => {
    return ventasDia.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
  }, [ventasDia, paginaActual]);

  const totalPaginasHistorial = Math.ceil(historialCierres.length / cierresPorPagina);
  const cierresPaginados = useMemo(() => {
    return historialCierres.slice((paginaHistorial - 1) * cierresPorPagina, paginaHistorial * cierresPorPagina);
  }, [historialCierres, paginaHistorial]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', padding: '5px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
        <div>
          <h2 style={{ color: theme.text, fontWeight: '900', margin: 0, fontSize: isMobile ? '1.5rem' : '2rem', letterSpacing: '-0.5px' }}>📊 Cierre y Auditoría Diaria</h2>
          <p style={{ color: theme.subtext, margin: '6px 0 0 0', fontSize: '0.95rem' }}>Control discriminado de márgenes de venta mayorista y minorista con sincronización activa</p>
        </div>
        <button 
          onClick={() => { setVerHistorialCierres(!verHistorialCierres); setCierreSeleccionado(null); }} 
          style={{ backgroundColor: verHistorialCierres ? '#ef4444' : '#6366f1', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', width: isMobile ? '100%' : 'auto' }}
        >
          {verHistorialCierres ? '❌ Volver al Panel Vivo' : '📜 Ver Historial de Cierres'}
        </button>
      </div>

      {verHistorialCierres ? (
        <div style={cardStyle}>
          <h3 style={{ color: '#6366f1', margin: '0 0 20px 0', fontWeight: '800', fontSize: '1.3rem' }}>📜 Historial de Balances Archivados</h3>
          
          {cierreSeleccionado ? (
            <div style={{ backgroundColor: theme.innerBox, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: theme.text }}>📅 Resumen: {cierreSeleccionado.fecha_cierre}</span>
                <button onClick={() => setCierreSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>◀ Volver al listado</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ backgroundColor: theme.card, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '0.85rem', color: theme.subtext }}>TOTAL GENERAL RECAUDADO</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '900', color: theme.text }}>${cierreSeleccionado.total_facturado.toLocaleString('es-AR')}</div>
                </div>
                <div style={{ backgroundColor: theme.card, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: '0.85rem', color: '#10b981' }}>GANANCIA REAL EFECTIVA</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#10b981' }}>${cierreSeleccionado.ganancia_neta.toLocaleString('es-AR')}</div>
                </div>
              </div>

              {cierreSeleccionado.detalles_json && (() => {
                const js = JSON.parse(cierreSeleccionado.detalles_json);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ margin: '10px 0 0 0', color: theme.text }}>Desglose de la Jornada Archivada:</h4>
                    {renderFilaDesglose("Canal Minorista Tradicional", js.minorista, '#3b82f6')}
                    {renderFilaDesglose("Canal Mayorista / Distribución", js.mayorista, '#a855f7')}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historialCierres.length === 0 ? (
                <p style={{ color: theme.subtext, textAlign: 'center', padding: '30px' }}>No hay registros de cierre en el sistema.</p>
              ) : (
                cierresPaginados.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => setCierreSeleccionado(c)}
                    style={{ backgroundColor: theme.innerBox, padding: '16px 20px', borderRadius: '14px', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.005)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    <div>
                      <div style={{ color: theme.text, fontWeight: 'bold', fontSize: '1.1rem' }}>📅 {c.fecha_cierre}</div>
                      <div style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '4px' }}>Monto: <strong>${c.total_facturado.toLocaleString('es-AR')}</strong> • Ganancia: <strong style={{ color: '#10b981' }}>${c.ganancia_neta.toLocaleString('es-AR')}</strong></div>
                    </div>
                    <span style={{ color: '#6366f1', fontSize: '0.9rem', fontWeight: 'bold' }}>🔎 Ver Resumen</span>
                  </div>
                ))
              )}

              {totalPaginasHistorial > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '15px' }}>
                  {Array.from({ length: totalPaginasHistorial }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => setPaginaHistorial(n)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: paginaHistorial === n ? '#6366f1' : theme.innerBox, color: paginaHistorial === n ? '#fff' : theme.text, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* TOTALIZADORES */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '25px', width: '100%' }}>
            <div style={{ ...cardStyle, borderLeft: '6px solid #3b82f6' }}>
              <h4 style={{ color: theme.subtext, margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '800' }}>Caja Bruta General Vendida</h4>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: theme.text, marginTop: '8px', fontFamily: 'monospace' }}>
                ${balances.totalGeneral.toLocaleString('es-AR')}
              </div>
            </div>

            <div style={{ ...cardStyle, borderLeft: '6px solid #10b981', backgroundColor: darkMode ? '#13231c' : '#f0fdf4' }}>
              <h4 style={{ color: darkMode ? '#a7f3d0' : '#065f46', margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '800' }}>Ganancia Neta Consolidada (Menos Costos)</h4>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10b981', marginTop: '8px', fontFamily: 'monospace' }}>
                ${balances.gananciaNetaGeneral.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          {/* DESGLOSE DISCRIMINADO */}
          <div style={cardStyle}>
            <h3 style={{ color: theme.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '20px' }}>🛒 Rendimiento Comercial de la Caja Activa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {renderFilaDesglose("Fila Ventas Minoristas", balances.desglose.minorista, '#3b82f6')}
              {renderFilaDesglose("Fila Ventas Mayoristas", balances.desglose.mayorista, '#a855f7')}
            </div>

            {/* BOTÓN ARQUEO DE CONTROL DE EFECTIVO Y TRANSFERENCIA */}
            <div style={{ display: 'flex', marginTop: '25px', backgroundColor: theme.innerBox, padding: '20px', borderRadius: '16px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.95rem', color: theme.text }}>
                <div>💵 Total Efectivo a Rendir en Caja Física: <strong style={{ color: '#3b82f6', fontSize: '1.1rem', fontFamily: 'monospace' }}>${(balances.desglose.minorista.efectivo + balances.desglose.mayorista.efectivo).toLocaleString('es-AR')}</strong></div>
                <div style={{ marginTop: '4px' }}>📲 Total Esperado en Cuentas/Transferencias: <strong style={{ color: '#8b5cf6', fontSize: '1.1rem', fontFamily: 'monospace' }}>${(balances.desglose.minorista.transferencia + balances.desglose.mayorista.transferencia).toLocaleString('es-AR')}</strong></div>
              </div>
              <button 
                onClick={ejecutarCierreDeCaja}
                style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)', width: isMobile ? '100%' : 'auto' }}
              >
                🔒 EJECUTAR CIERRE DE CAJA DIARIO
              </button>
            </div>
          </div>

          {/* AUDITORÍA DE TICKETS DEL DÍA */}
          <div style={cardStyle}>
            <h3 style={{ color: theme.text, fontSize: '1.1rem', fontWeight: '800', marginBottom: '15px' }}>📋 Operaciones Recientes Sincronizadas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ventasDia.length === 0 ? (
                <p style={{ color: theme.subtext, textAlign: 'center', padding: '20px' }}>Ninguna venta realizada en la fecha.</p>
              ) : (
                ventasPaginaActual.map((v) => {
                  const esMayoristaFila = Boolean(
                    v.tipo?.toLowerCase() === 'mayorista' || 
                    v.es_mayorista ||
                    (v.cliente_id !== null && v.cliente_id !== undefined && v.cliente_id !== '') || 
                    (v.cliente_nombre && v.cliente_nombre !== 'Venta Minorista Mostrador')
                  );
                  return (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: theme.innerBox, borderRadius: '10px', border: `1px solid ${theme.border}`, fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ backgroundColor: esMayoristaFila ? '#a855f7' : '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', marginRight: '8px', fontWeight: 'bold' }}>
                          {esMayoristaFila ? 'MAYORISTA' : 'MINORISTA'}
                        </span>
                        <strong style={{ color: theme.text }}>{v.metodo_pago}</strong>
                        {v.cliente_nombre && <span style={{ color: theme.subtext }}> • Cl: {v.cliente_nombre}</span>}
                      </div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: theme.text }}>
                        ${Number(v.total).toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}