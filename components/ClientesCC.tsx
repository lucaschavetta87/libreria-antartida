"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../app/supabase';
import { useToast } from './ui/Avisos';

export default function ClientesCC({ darkMode = true }: { darkMode?: boolean }) {
  const toast = useToast();
  const { confirmar } = toast;
  const [clientes, setClientes] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [descuentoEspecial, setDescuentoEspecial] = useState('0');
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  
  const [clienteExpandido, setClienteExpandido] = useState<any>(null);
  const [comprasPendientes, setComprasPendientes] = useState<any[]>([]);
  
  // ESTADO PARA EDICIÓN
  const [editandoDesc, setEditandoDesc] = useState(false);
  const [nuevoDesc, setNuevoDesc] = useState('0');

  // --- ESTADOS PARA PAGINACIÓN ---
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // --- DETECCIÓN DE PANTALLA RESPONSIVE ---
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
    input: darkMode ? '#0f172a' : '#ffffff',
    innerBox: darkMode ? '#0f172a' : '#f1f5f9',
    accent: '#8B5CF6'
  };

  const cardStyle: React.CSSProperties = { 
    backgroundColor: theme.card, 
    padding: isMobile ? '20px 14px' : '25px', 
    borderRadius: '24px', 
    border: `1px solid ${theme.border}`, 
    boxShadow: darkMode ? '0 10px 25px -5px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.05)',
    width: '100%',
    transition: 'all 0.3s'
  };

  const inputStyle: React.CSSProperties = { 
    padding: '12px', 
    borderRadius: '10px', 
    border: `1px solid ${theme.border}`, 
    backgroundColor: theme.input, 
    color: theme.text, 
    width: '100%', 
    outline: 'none', 
    marginBottom: '15px',
    fontSize: '16px'
  };

  const btnStyle: React.CSSProperties = { 
    padding: '12px 20px', 
    borderRadius: '10px', 
    border: 'none', 
    fontWeight: 'bold', 
    cursor: 'pointer',
    fontSize: '15px',
    transition: '0.2s'
  };

  const actionIconStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  };

  const cargarClientes = async () => {
    setCargando(true);
    const { data } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
    if (data) setClientes(data);
    setCargando(false);
  };

  useEffect(() => { cargarClientes(); }, []);

  const verDetalleCliente = async (cliente: any) => {
    setClienteExpandido(cliente);
    setNuevoDesc(cliente.descuento_especial?.toString() || '0');
    setEditandoDesc(false);
    
    const { data } = await supabase
      .from('ventas')
      .select('*')
      .eq('cliente_id', cliente.id)
      .eq('metodo_pago', 'Cuenta Corriente')
      .eq('estado', 'completada');
    if (data) setComprasPendientes(data);
  };

  const crearCliente = async () => {
    if (!nombre.trim()) return toast.avisar("Por favor, ingresa el nombre.", 'alerta');
    const descNum = Number(descuentoEspecial) || 0;
    if (descNum < 0 || descNum > 100) return toast.avisar("El descuento debe estar entre 0% y 100%.", 'alerta');

    try {
      await supabase.from('clientes').insert([{ nombre, telefono, localidad, domicilio, codigo_postal: codigoPostal, saldo_cc: 0, descuento_especial: descNum }]);
      toast.exito("Cliente guardado correctamente.");
      setNombre(''); setTelefono(''); setLocalidad(''); setDomicilio(''); setCodigoPostal(''); setDescuentoEspecial('0');
      cargarClientes();
    } catch (e: any) { toast.error("Error: " + e.message); }
  };

  const guardarEdicionDescuento = async () => {
    const desc = Number(nuevoDesc);
    if (desc < 0 || desc > 100) return toast.avisar("El descuento debe estar entre 0% y 100%.", 'alerta');
    
    const { error } = await supabase
      .from('clientes')
      .update({ descuento_especial: desc })
      .eq('id', clienteExpandido.id);

    if (!error) {
      toast.exito("Descuento actualizado con éxito.");
      setClienteExpandido({ ...clienteExpandido, descuento_especial: desc });
      setEditandoDesc(false);
      cargarClientes();
    } else {
      toast.error("Error al guardar el descuento.");
    }
  };

  const registrarPagoCaja = async (monto: number, metodo: string, cl: any) => {
    await supabase.from('ventas').insert([{
      id: Date.now(),
      fecha: new Date().toLocaleString('es-AR'),
      subtotal: monto,
      descuento: 0,
      total: monto,
      metodo_pago: metodo,
      cliente_id: cl.id,
      cliente_nombre: cl.nombre,
      estado: 'completada',
      items: [{ id: 999, nombre: `COBRO ENTREGA CUENTA CORRIENTE`, precio_venta: monto, unidades: 1 }]
    }]);
  };

  const registrarPago = async (cliente: any) => {
    const montoStr = prompt(`¿Cuánto abona ${cliente.nombre}? (Deuda actual: $${cliente.saldo_cc})`);
    if (montoStr === null) return;
    const monto = Math.round(Number(montoStr));
    if (isNaN(monto) || monto <= 0 || monto > cliente.saldo_cc) return toast.avisar("Monto ingresado no válido.", 'alerta');
    const metodo = prompt("Ingrese método de recepción (Efectivo / Transferencia / Tarjeta):", "Efectivo");
    if (!metodo) return;

    const { error } = await supabase.from('clientes').update({ saldo_cc: cliente.saldo_cc - monto }).eq('id', cliente.id);
    if (!error) { 
      await registrarPagoCaja(monto, metodo, cliente); 
      toast.exito(`Pago asentado. Nuevo saldo de deuda: $${cliente.saldo_cc - monto}`);
      await cargarClientes(); 
      setClienteExpandido(null); 
    }
  };

  const saldarTotal = async (cliente: any) => {
    if (cliente.saldo_cc <= 0) return toast.avisar("Este cliente ya está al día.", 'info');
    const metodo = prompt("¿Cómo liquida la deuda? (Efectivo / Transferencia / Tarjeta):", "Efectivo");
    if (!metodo) return;
    if (await confirmar({ titulo: 'Confirmar cancelación', mensaje: `¿Confirmás saldar el total de $${cliente.saldo_cc} e ingresarlo a caja?`, textoOk: 'Sí, saldar' })) {
        const { error } = await supabase.from('clientes').update({ saldo_cc: 0 }).eq('id', cliente.id);
        if (!error) { 
          await registrarPagoCaja(cliente.saldo_cc, metodo, cliente); 
          toast.exito("Cuenta totalmente saldada.");
          await cargarClientes(); 
          setClienteExpandido(null); 
        }
    }
  };

  const eliminarCliente = async (e: React.MouseEvent, cliente: any) => {
    e.stopPropagation();
    if (cliente.saldo_cc > 0) {
      if (!(await confirmar({ titulo: 'El cliente tiene deuda', mensaje: `Debe $${cliente.saldo_cc}. ¿Seguro que querés borrarlo igual?`, textoOk: 'Borrar igual', peligro: true }))) return;
    } else {
      if (!(await confirmar({ titulo: 'Eliminar cliente', mensaje: `¿Eliminar de la lista a ${cliente.nombre}?`, textoOk: 'Eliminar', peligro: true }))) return;
    }
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
    if (!error) {
      toast.exito("Cliente removido.");
      cargarClientes();
      if (clienteExpandido?.id === cliente.id) setClienteExpandido(null);
    }
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => c.nombre.toLowerCase().includes(filtro.toLowerCase()));
  }, [clientes, filtro]);

  const totalPaginas = Math.ceil(clientesFiltrados.length / itemsPorPagina);
  const clientesPaginados = useMemo(() => {
    return clientesFiltrados.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
  }, [clientesFiltrados, paginaActual]);

  const cambiarPagina = (numeroPagina: number) => setPaginaActual(numeroPagina);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', padding: '10px', width: '100%' }}>
      
      {/* SECCIÓN ARRIBA: INGRESO DE CLIENTE + TOTAL CC */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', width: '100%' }}>
        
        {/* Formulario de Alta de Cliente */}
        <div style={{ ...cardStyle, flex: 2 }}>
          <h2 style={{ color: theme.text, marginBottom: '20px', fontSize: '1.4rem', fontWeight: '800' }}>👤 Registrar Cliente</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>NOMBRE COMPLETO</label>
              <input style={{ ...inputStyle, marginBottom: 0 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>TELÉFONO DE CONTACTO</label>
              <input style={{ ...inputStyle, marginBottom: 0 }} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 261XXXXXXX" />
            </div>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>DESCUENTO AUTOMÁTICO (%)</label>
              <input type="number" style={{ ...inputStyle, marginBottom: 0 }} value={descuentoEspecial} onChange={e => setDescuentoEspecial(e.target.value)} min="0" max="100" />
            </div>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>LOCALIDAD</label>
              <input style={{ ...inputStyle, marginBottom: 0 }} value={localidad} onChange={e => setLocalidad(e.target.value)} placeholder="Ej: Capital Federal" />
            </div>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>DOMICILIO</label>
              <input style={{ ...inputStyle, marginBottom: 0 }} value={domicilio} onChange={e => setDomicilio(e.target.value)} placeholder="Ej: Av. Siempre Viva 123" />
            </div>
            <div>
              <label style={{ color: theme.subtext, fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>CÓDIGO POSTAL</label>
              <input type="text" style={{ ...inputStyle, marginBottom: 0 }} value={codigoPostal} onChange={e => setCodigoPostal(e.target.value)} placeholder="Ej: 1425" />
            </div>
          </div>

          <button onClick={crearCliente} style={{ ...btnStyle, backgroundColor: '#3b82f6', color: '#fff', width: '100%', marginTop: '20px' }}>
            ➕ GUARDAR CLIENTE EN SISTEMA
          </button>
        </div>

        {/* Cuadro Resumen Deuda Total */}
        <div style={{ 
          ...cardStyle, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          textAlign: 'center', 
          border: `2px solid ${darkMode ? '#7f1d1d' : '#fee2e2'}`,
          minWidth: isMobile ? '100%' : '280px'
        }}>
            <h4 style={{ color: theme.subtext, margin: 0, fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>TOTAL COMPRAS EN CALLE (CC)</h4>
            <div style={{ fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: '900', color: '#f87171', marginTop: '8px', fontFamily: 'monospace' }}>
                ${clientes.reduce((acc, c) => acc + (Number(c.saldo_cc) || 0), 0).toLocaleString('es-AR')}
            </div>
        </div>

      </div>

      {/* SECCIÓN ABAJO: LISTADO / DETALLE COMPLETO (FILTRADO Y PAGINADO DE A 10) */}
      <div style={cardStyle}>
        {!clienteExpandido ? (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
                <h2 style={{ color: theme.text, fontWeight: '800', margin: 0 }}>💳 Listado de Cuentas Corrientes</h2>
                <input 
                  placeholder="🔍 Buscar cliente por nombre..." 
                  value={filtro} 
                  onChange={e => { setFiltro(e.target.value); setPaginaActual(1); }} 
                  style={{ ...inputStyle, width: isMobile ? '100%' : '350px', marginBottom: 0 }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {clientesPaginados.map(cliente => (
                  <div key={cliente.id} onClick={() => verDetalleCliente(cliente)} 
                       style={{ 
                         display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', 
                         padding: '16px 20px', backgroundColor: theme.innerBox, borderRadius: '18px', 
                         border: `1px solid ${theme.border}`, cursor: 'pointer', flexDirection: isMobile ? 'column' : 'row', gap: '14px' 
                       }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', flex: 1 }}>
                      <button 
                        onClick={(e) => eliminarCliente(e, cliente)} 
                        style={{ ...actionIconStyle, backgroundColor: darkMode ? '#2d1a1a' : '#fee2e2', color: '#f87171', border: `1px solid ${darkMode ? '#7f1d1d' : '#f87171'}` }}
                        title="Eliminar Cliente"
                      >
                        🗑️
                      </button>
                      
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ color: theme.text, fontWeight: 'bold', fontSize: '1.1rem' }}>{cliente.nombre}</span>
                          {Number(cliente.descuento_especial) > 0 && (
                            <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                              🎯 Gremio {cliente.descuento_especial}% off
                            </span>
                          )}
                        </div>
                        <div style={{ color: theme.subtext, fontSize: '0.85rem', marginTop: '4px' }}>📞 {cliente.telefono || 'Sin número de contacto'}</div>
                        {cliente.localidad && (
                          <div style={{ color: theme.subtext, fontSize: '0.85rem', marginTop: '2px' }}>📍 {cliente.localidad}</div>
                        )}
                        {cliente.domicilio && (
                          <div style={{ color: theme.subtext, fontSize: '0.85rem', marginTop: '2px' }}>🏠 {cliente.domicilio}</div>
                        )}
                        {cliente.codigo_postal && (
                          <div style={{ color: theme.subtext, fontSize: '0.85rem', marginTop: '2px' }}>📮 C.P. {cliente.codigo_postal}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', paddingLeft: isMobile ? '48px' : '0' }}>
                      <span style={{ 
                        padding: '6px 14px', borderRadius: '8px', fontSize: '1.05rem', fontWeight: '900', fontFamily: 'monospace',
                        backgroundColor: cliente.saldo_cc > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: cliente.saldo_cc > 0 ? '#f87171' : '#10b981'
                      }}>
                        ${(Number(cliente.saldo_cc) || 0).toLocaleString('es-AR')}
                      </span>
                      <span style={{ color: theme.subtext, fontSize: '1.1rem', display: isMobile ? 'none' : 'block' }}>▶</span>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* BOTONERA DEL PAGINADOR DINÁMICO (SÓLO SI HAY MÁS DE 1 PÁGINA) */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '25px', paddingTop: '15px', borderTop: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
                <button disabled={paginaActual === 1} onClick={() => cambiarPagina(paginaActual - 1)} style={{ background: 'none', border: 'none', color: paginaActual === 1 ? theme.subtext : '#3b82f6', cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '10px' }}>◀ Anterior</button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                  <button key={num} onClick={() => cambiarPagina(num)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: paginaActual === num ? '#3b82f6' : theme.innerBox, color: paginaActual === num ? '#ffffff' : theme.text }}>{num}</button>
                ))}
                <button disabled={paginaActual === totalPaginas} onClick={() => cambiarPagina(paginaActual + 1)} style={{ background: 'none', border: 'none', color: paginaActual === totalPaginas ? theme.subtext : '#3b82f6', cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', fontWeight: 'bold', padding: '10px' }}>Siguiente ▶</button>
              </div>
            )}
          </>
        ) : (
          /* VISTA DETALLE CON CONTROLES AVANZADOS */
          <div>
            <button onClick={() => setClienteExpandido(null)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px', padding: '6px 0', fontSize: '0.95rem' }}>⬅️ VOLVER A LA LISTA</button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '30px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '20px', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
                <div>
                  <h2 style={{ color: theme.text, margin: 0, fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: '800' }}>{clienteExpandido.nombre}</h2>
                  <p style={{ color: theme.subtext, margin: '4px 0 0 0', fontSize: '0.9rem' }}>Gestión de cuenta y configuración de tarifas gremiales</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px', backgroundColor: theme.innerBox, padding: '8px 14px', borderRadius: '10px', border: `1px solid ${theme.border}`, width: 'fit-content' }}>
                    <span style={{ fontSize: '0.9rem', color: theme.text, fontWeight: '600' }}>
                      Descuento Fijo: <strong style={{ color: '#8b5cf6' }}>{clienteExpandido.descuento_especial}%</strong>
                    </span>
                    
                    {editandoDesc ? (
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <input type="number" style={{ ...inputStyle, width: '65px', padding: '6px', marginBottom: 0, fontSize: '14px' }} value={nuevoDesc} onChange={(e) => setNuevoDesc(e.target.value)} min="0" max="100" />
                         <button onClick={guardarEdicionDescuento} style={{ ...btnStyle, padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', fontSize: '13px' }}>✔</button>
                         <button onClick={() => setEditandoDesc(false)} style={{ ...btnStyle, padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', fontSize: '13px' }}>✕</button>
                       </div>
                    ) : (
                       <button 
                         onClick={() => setEditandoDesc(true)} 
                         style={{ ...actionIconStyle, backgroundColor: darkMode ? '#334155' : '#e2e8f0', color: theme.text }}
                         title="Editar Porcentaje"
                       >
                         ✏️ Editar
                       </button>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: isMobile ? 'left' : 'right', width: isMobile ? '100%' : 'auto' }}>
                  <div style={{ color: clienteExpandido.saldo_cc > 0 ? '#f87171' : '#10b981', fontSize: '1.8rem', fontWeight: '900', fontFamily: 'monospace' }}>
                    Debe: ${(Number(clienteExpandido.saldo_cc) || 0).toLocaleString('es-AR')}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <button onClick={() => registrarPago(clienteExpandido)} style={{ ...btnStyle, backgroundColor: darkMode ? '#334155' : '#e2e8f0', color: theme.text, width: isMobile ? '100%' : 'auto' }}>💸 PAGAR PARCIAL</button>
                    <button onClick={() => saldarTotal(clienteExpandido)} style={{ ...btnStyle, backgroundColor: '#10b981', color: '#fff', width: isMobile ? '100%' : 'auto' }}>✅ SALDAR TOTAL</button>
                  </div>
                </div>
            </div>
            
            {/* HISTORIAL CC */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h4 style={{ color: theme.subtext, margin: 0, fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>📜 Historial de notas en Cuenta Corriente</h4>
              {comprasPendientes.length > 0 ? (
                comprasPendientes.map((compra) => (
                  <div key={compra.id} style={{ backgroundColor: theme.innerBox, padding: '18px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', border: `1px solid ${theme.border}`, flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: theme.text, fontSize: '0.95rem', lineHeight: '1.4' }}>
                        {Array.isArray(compra.items) ? compra.items.map((i: any) => `${i.unidades}x ${i.nombre}`).join(', ') : 'Compra General'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: theme.subtext, marginTop: '6px' }}>
                        📅 Registrado el: <span style={{ color: theme.accent, fontWeight: '600' }}>{compra.fecha}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: '900', color: '#f87171', fontSize: '1.15rem', minWidth: '90px', textAlign: isMobile ? 'left' : 'right', width: isMobile ? '100%' : 'auto', fontFamily: 'monospace' }}>
                      ${Number(compra.total).toLocaleString('es-AR')}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: theme.subtext, marginTop: '20px', width: '100%' }}>No hay transacciones registradas históricas en Cuenta Corriente para este perfil.</p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}