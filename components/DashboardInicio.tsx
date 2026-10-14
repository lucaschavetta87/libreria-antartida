"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../app/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface MetricasType {
  ventasHoy: number;
  totalCalle: number;
  productosBajoStock: number;
  clientesActivos: number;
  graficoSemana: Array<{ fecha: string; Total: number; Ganancia: number }>;
  graficoMeses: Array<{ mes: string; Total: number; Ganancia: number }>;
}

export default function DashboardInicio({ darkMode = true, APP_TITLE = "Pueblos de la India" }: { darkMode?: boolean; APP_TITLE?: string }) {
  const [metricas, setMetricas] = useState<MetricasType>({
    ventasHoy: 0,
    totalCalle: 0,
    productosBajoStock: 0,
    clientesActivos: 0,
    graficoSemana: [],
    graficoMeses: []
  });
  const [cargando, setCargando] = useState(true);
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
    text: darkMode ? '#f8fafc' : '#111827',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    accent: '#8B5CF6',
    success: '#10b981',
    danger: '#ef4444'
  };

  const cargarMetricasYBalances = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // 1. Sincronizar el Mapa de Precios y Costos Vivos de la tabla Stock
      const { data: stockItems } = await supabase
        .from('stock')
        .select('nombre, precio_costo, precio_minorista, precio_mayorista');
      
      const mapaPrecios = new Map<string, { costo: number; venta: number }>();
      if (stockItems) {
        stockItems.forEach((item: any) => {
          if (item.nombre) {
            mapaPrecios.set(item.nombre.trim().toLowerCase(), {
              costo: Number(item.precio_costo) || 0,
              venta: Number(item.precio_minorista || item.precio_mayorista) || 0
            });
          }
        });
      }

      // 2. Traer Ventas completadas
      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('estado', 'completada');

      const ventasValidas = ventas || [];
      const hoy = new Date();

      const obtenerFechaVenta = (v: any) => {
        if (v.created_at) return new Date(v.created_at);
        if (v.id && !isNaN(Number(v.id)) && String(v.id).length > 10) return new Date(Number(v.id));
        if (v.fecha) {
          // Intento de parseo de fecha en string "DD/MM/YYYY, HH:MM:SS" o similar
          const partes = v.fecha.split(/[\/\s,:]+/);
          if (partes.length >= 3) {
            return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
          }
        }
        return null;
      };

      // Calcular caja de hoy de forma robusta
      let totalVentasHoy = 0;
      ventasValidas.forEach((venta: any) => {
        const fechaVenta = obtenerFechaVenta(venta);
        if (!fechaVenta || isNaN(fechaVenta.getTime())) return;

        const esHoy = 
          fechaVenta.getDate() === hoy.getDate() &&
          fechaVenta.getMonth() === hoy.getMonth() &&
          fechaVenta.getFullYear() === hoy.getFullYear();

        if (esHoy) {
          totalVentasHoy += Number(venta.total || 0);
        }
      });

      // 3. Traer Clientes (Saldos en calle)
      const { data: clientes } = await supabase.from('clientes').select('saldo_cc');
      const totalCalle = clientes ? clientes.reduce((acc: number, c: any) => acc + (Number(c.saldo_cc) || 0), 0) : 0;
      const cantidadClientes = clientes ? clientes.length : 0;

      // 4. Conteo seguro de productos en catálogo
      const { count: totalProductos } = await supabase.from('stock').select('*', { count: 'exact', head: true });

      // --- GENERAR DATOS PARA EL GRÁFICO SEMANAL (Últimos 7 días) ---
      const graficoSemana = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        
        const ventasDelDia = ventasValidas.filter((v: any) => {
          const fv = obtenerFechaVenta(v);
          return fv && 
            fv.getDate() === d.getDate() && 
            fv.getMonth() === d.getMonth() && 
            fv.getFullYear() === d.getFullYear();
        });

        let cajaBrutaTotal = 0;
        let costoTotalReposicion = 0;

        ventasDelDia.forEach((venta: any) => {
          const netoVenta = Number(venta.total || 0);
          cajaBrutaTotal += netoVenta;

          if (Array.isArray(venta.items)) {
            venta.items.forEach((item: any) => {
              const nombreClave = item.nombre ? item.nombre.trim().toLowerCase() : '';
              const vivo = mapaPrecios.get(nombreClave);
              const costoUnitario = Number(item.precio_costo) || vivo?.costo || 0;
              const unidades = Number(item.unidades || 1);
              costoTotalReposicion += (costoUnitario * unidades);
            });
          } else {
            costoTotalReposicion += netoVenta * 0.65; // Margen de resguardo
          }
        });

        return {
          fecha: `${d.getDate()}/${d.getMonth() + 1}`,
          Total: cajaBrutaTotal,
          Ganancia: Math.max(0, cajaBrutaTotal - costoTotalReposicion)
        };
      });

      // --- GENERAR DATOS PARA EL GRÁFICO MENSUAL (Últimos 6 meses) ---
      const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const graficoMeses = [...Array(6)].map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const mesIndex = d.getMonth();
        const anio = d.getFullYear();

        const ventasDelMes = ventasValidas.filter((v: any) => {
          const fv = obtenerFechaVenta(v);
          return fv && fv.getMonth() === mesIndex && fv.getFullYear() === anio;
        });

        let cajaBrutaTotal = 0;
        let costoTotalReposicion = 0;

        ventasDelMes.forEach((venta: any) => {
          const netoVenta = Number(venta.total || 0);
          cajaBrutaTotal += netoVenta;

          if (Array.isArray(venta.items)) {
            venta.items.forEach((item: any) => {
              const nombreClave = item.nombre ? item.nombre.trim().toLowerCase() : '';
              const vivo = mapaPrecios.get(nombreClave);
              const costoUnitario = Number(item.precio_costo) || vivo?.costo || 0;
              const unidades = Number(item.unidades || 1);
              costoTotalReposicion += (costoUnitario * unidades);
            });
          } else {
            costoTotalReposicion += netoVenta * 0.65;
          }
        });

        return {
          mes: `${nombresMeses[mesIndex]} ${String(anio).slice(-2)}`,
          Total: cajaBrutaTotal,
          Ganancia: Math.max(0, cajaBrutaTotal - costoTotalReposicion)
        };
      });

      setMetricas({
        ventasHoy: totalVentasHoy,
        totalCalle: totalCalle,
        productosBajoStock: totalProductos || 0,
        clientesActivos: cantidadClientes,
        graficoSemana,
        graficoMeses
      });
    } catch (error) {
      console.error("Error al estructurar las métricas avanzadas:", error);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarMetricasYBalances();
  }, []);

  // --- ESCUCHADOR EN TIEMPO REAL (REALTIME) ---
  useEffect(() => {
    const canalVentasInicio = supabase
      .channel('realtime-dashboard-ventas')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'ventas' }, 
        () => {
          cargarMetricasYBalances(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalVentasInicio);
    };
  }, []);

  const gridCardsStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    width: '100%',
    marginBottom: '25px'
  };

  const gridGraficosStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '25px',
    width: '100%'
  };

  const cardStyle = (borderColor: string): React.CSSProperties => ({
    backgroundColor: theme.card,
    padding: '22px',
    borderRadius: '20px',
    borderTop: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
    borderLeft: `5px solid ${borderColor}`,
    boxShadow: darkMode ? '0 4px 15px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  });

  const chartContainerStyle: React.CSSProperties = {
    backgroundColor: theme.card,
    padding: '25px 20px 15px 10px',
    borderRadius: '24px',
    border: `1px solid ${theme.border}`,
    boxShadow: darkMode ? '0 4px 15px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
    height: '380px',
    width: '100%'
  };

  if (cargando) {
    return <p style={{ color: theme.subtext, textAlign: 'center', marginTop: '40px', fontWeight: 'bold' }}>⏳ Sincronizando balances históricos con precios de stock...</p>;
  }

  return (
    <div style={{ width: '100%', padding: '5px' }}>
      
      {/* HEADER DEL DASHBOARD */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: theme.text, margin: 0, fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: 900 }}>{APP_TITLE}</h1>
        <p style={{ color: theme.subtext, margin: '4px 0 0 0', fontSize: '0.95rem' }}>Análisis de rentabilidad y control financiero masivo</p>
      </div>

      {/* RECUADROS DE MÉTRICAS */}
      <div style={gridCardsStyle}>
        <div style={cardStyle(theme.success)}>
          <span style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>CAJA DIARIA (HOY)</span>
          <span style={{ color: theme.text, fontSize: '1.8rem', fontWeight: '900' }}>${metricas.ventasHoy.toLocaleString('es-AR')}</span>
          <span style={{ color: theme.success, fontSize: '0.85rem' }}>📈 Entradas del día en tiempo real</span>
        </div>

        <div style={cardStyle(theme.danger)}>
          <span style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>TOTAL EN CALLE (CC)</span>
          <span style={{ color: '#f87171', fontSize: '1.8rem', fontWeight: '900' }}>${metricas.totalCalle.toLocaleString('es-AR')}</span>
          <span style={{ color: theme.subtext, fontSize: '0.85rem' }}>⚠️ Créditos a cobrar</span>
        </div>

        <div style={cardStyle(theme.accent)}>
          <span style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>ARTÍCULOS EN CATÁLOGO</span>
          <span style={{ color: theme.text, fontSize: '1.8rem', fontWeight: '900' }}>{metricas.productosBajoStock}</span>
          <span style={{ color: theme.subtext, fontSize: '0.85rem' }}>📦 Productos activos</span>
        </div>

        <div style={cardStyle(theme.accent)}>
          <span style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>CARTERA DE CLIENTES</span>
          <span style={{ color: theme.text, fontSize: '1.8rem', fontWeight: '900' }}>{metricas.clientesActivos}</span>
          <span style={{ color: theme.accent, fontSize: '0.85rem' }}>👥 Cuentas registradas</span>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS COMPARATIVOS */}
      <div style={gridGraficosStyle}>
        
        {/* Gráfico 1: Rendimiento Semanal */}
        <div style={chartContainerStyle}>
          <h3 style={{ color: theme.text, margin: '0 0 20px 15px', fontSize: '1.1rem', fontWeight: '800' }}>📅 RENDIMIENTO SEMANAL</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={metricas.graficoSemana} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} vertical={false} />
              <XAxis dataKey="fecha" stroke={theme.subtext} tick={{ fontSize: 12, fontWeight: '600' }} tickLine={false} />
              <YAxis stroke={theme.subtext} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, color: theme.text }}
                formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
              <Bar dataKey="Total" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Caja Bruta Total" />
              <Bar dataKey="Ganancia" fill="#10b981" radius={[6, 6, 0, 0]} name="Ganancia Real Neta" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2: Rendimiento Mensual */}
        <div style={chartContainerStyle}>
          <h3 style={{ color: theme.text, margin: '0 0 20px 15px', fontSize: '1.1rem', fontWeight: '800' }}>📈 EVOLUCIÓN MENSUAL (ÚLTIMOS 6 MESES)</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={metricas.graficoMeses} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} vertical={false} />
              <XAxis dataKey="mes" stroke={theme.subtext} tick={{ fontSize: 12, fontWeight: '600' }} tickLine={false} />
              <YAxis stroke={theme.subtext} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, color: theme.text }}
                formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
              <Bar dataKey="Total" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Caja Bruta Total" />
              <Bar dataKey="Ganancia" fill="#10b981" radius={[6, 6, 0, 0]} name="Ganancia Real Neta" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}