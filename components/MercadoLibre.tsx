"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../app/supabase';
import { useToast } from './ui/Avisos';

interface MLProducto {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  status: string;
  thumbnail: string;
  permalink: string;
  sold_quantity?: number;
  visits?: number;
}

interface MLVenta {
  id: number;
  buyer: { id: number; nickname: string; email?: string; phone?: { number: string } };
  order_items: Array<{ item: { id: string; title: string }; quantity: number; unit_price: number }>;
  total_amount: number;
  status: string;
  date_created: string;
  shipping?: { id: number; status: string; tracking_number?: string };
  payments?: Array<{ status: string; payment_method_id: string }>;
}

interface MLToken {
  user_id_ml: number | null;
  nickname: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

export default function MercadoLibre({ darkMode = true }: { darkMode?: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<'conectar' | 'productos' | 'ventas'>('conectar');
  const [token, setToken] = useState<MLToken | null>(null);
  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState<MLProducto[]>([]);
  const [ventas, setVentas] = useState<MLVenta[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<MLVenta | null>(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#1e293b',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    innerBox: darkMode ? '#0f172a' : '#f1f5f9'
  };

  // Cargar token de ML
  const cargarToken = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase.from('ml_tokens').select('*').eq('id', 'config').single();
      if (!error && data) {
        setToken(data as MLToken);
      } else {
        setToken(null);
      }
    } catch {
      setToken(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarToken(); }, []);

  // Verificar si las credenciales estan configuradas
  const credencialesConfiguradas = !!(process.env.NEXT_PUBLIC_ML_APP_ID && process.env.NEXT_PUBLIC_ML_SECRET_KEY);

  // URL de autorizacion
  const urlAuth = () => {
    const appId = process.env.NEXT_PUBLIC_ML_APP_ID || '';
    const redirect = process.env.NEXT_PUBLIC_ML_REDIRECT_URI || '';
    if (!appId || !redirect) return null;
    return `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}`;
  };

  // Desconectar
  const desconectar = async () => {
    if (!confirm('¿Desconectar MercadoLibre? Se perderá la sincronización.')) return;
    try {
      await supabase.from('ml_tokens').delete().eq('id', 'config');
      setToken(null);
      setProductos([]);
      setVentas([]);
      toast.avisar('MercadoLibre desconectado.', 'exito');
    } catch (e: any) {
      toast.error('Error al desconectar: ' + (e?.message || e));
    }
  };

  // Cargar productos de ML
  const cargarProductos = async () => {
    if (!token?.access_token || !token?.user_id_ml) return;
    setCargandoProductos(true);
    try {
      // Primero, buscar IDs de publicaciones
      const res = await fetch(`https://api.mercadolibre.com/users/${token.user_id_ml}/items/search`, {
        headers: { 'Authorization': `Bearer ${token.access_token}` }
      });
      if (!res.ok) throw new Error('Error al buscar publicaciones');
      const data = await res.json();
      const ids = data.results || [];
      
      // Traer detalle de cada publicacion (en lotes de 20)
      const detalles: MLProducto[] = [];
      for (let i = 0; i < ids.length; i += 20) {
        const lote = ids.slice(i, i + 20);
        const resDet = await fetch(`https://api.mercadolibre.com/items?ids=${lote.join(',')}`, {
          headers: { 'Authorization': `Bearer ${token.access_token}` }
        });
        if (resDet.ok) {
          const detData = await resDet.json();
          for (const d of detData) {
            if (d.code === 200 && d.body) {
              detalles.push({
                id: d.body.id,
                title: d.body.title,
                price: d.body.price,
                available_quantity: d.body.available_quantity,
                status: d.body.status,
                thumbnail: d.body.thumbnail,
                permalink: d.body.permalink,
                sold_quantity: d.body.sold_quantity,
                visits: d.body.visits
              });
            }
          }
        }
      }
      setProductos(detalles);
    } catch (e: any) {
      toast.error('Error al cargar productos: ' + (e?.message || e));
    } finally {
      setCargandoProductos(false);
    }
  };

  // Cargar ventas de ML
  const cargarVentas = async () => {
    if (!token?.access_token || !token?.user_id_ml) return;
    setCargandoVentas(true);
    try {
      const res = await fetch(`https://api.mercadolibre.com/orders/search?seller=${token.user_id_ml}&sort=date_desc&limit=50`, {
        headers: { 'Authorization': `Bearer ${token.access_token}` }
      });
      if (!res.ok) throw new Error('Error al buscar ventas');
      const data = await res.json();
      setVentas(data.results || []);
    } catch (e: any) {
      toast.error('Error al cargar ventas: ' + (e?.message || e));
    } finally {
      setCargandoVentas(false);
    }
  };

  // Pausar/activar publicacion
  const cambiarEstadoProducto = async (itemId: string, nuevoEstado: string) => {
    if (!token?.access_token) return;
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nuevoEstado })
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      toast.avisar(`Publicación ${nuevoEstado === 'active' ? 'activada' : 'pausada'}.`, 'exito');
      cargarProductos();
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || e));
    }
  };

  // Eliminar (cerrar) publicacion
  const eliminarProducto = async (itemId: string) => {
    if (!confirm('¿Cerrar esta publicación en MercadoLibre?')) return;
    if (!token?.access_token) return;
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      });
      if (!res.ok) throw new Error('Error al cerrar');
      toast.avisar('Publicación cerrada.', 'exito');
      cargarProductos();
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || e));
    }
  };

  // Editar precio de publicacion
  const editarPrecio = async (itemId: string, nuevoPrecio: number) => {
    if (!token?.access_token) return;
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: nuevoPrecio })
      });
      if (!res.ok) throw new Error('Error al actualizar precio');
      toast.avisar('Precio actualizado.', 'exito');
      cargarProductos();
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || e));
    }
  };

  // Editar stock de publicacion
  const editarStock = async (itemId: string, nuevoStock: number) => {
    if (!token?.access_token) return;
    try {
      const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_quantity: nuevoStock })
      });
      if (!res.ok) throw new Error('Error al actualizar stock');
      toast.avisar('Stock actualizado.', 'exito');
      cargarProductos();
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || e));
    }
  };

  // Imprimir guia de envio
  const imprimirGuia = (venta: MLVenta) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const comprador = venta.buyer?.nickname || 'Comprador';
    const telefono = venta.buyer?.phone?.number || '—';
    const fecha = new Date(venta.date_created).toLocaleDateString('es-AR');
    const direccion = venta.shipping ? `Envío #${venta.shipping.id}` : 'Sin envío';
    const tracking = venta.shipping?.tracking_number || '—';
    
    let items = '';
    if (venta.order_items) {
      for (const it of venta.order_items) {
        items += `<div style="padding:4px 0;border-bottom:1px dashed #ccc;">${it.quantity}x ${it.item?.title || 'Producto'} - $${(it.unit_price * it.quantity).toLocaleString('es-AR')}</div>`;
      }
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { margin: 5mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 5mm; font-size: 12px; }
      .header { text-align: center; margin-bottom: 8mm; }
      .header h1 { font-size: 22px; font-weight: 900; margin: 0 0 2mm; }
      .header h2 { font-size: 13px; color: #64748b; margin: 0; }
      .divider { border-top: 2px dashed #000; margin: 4mm 0; }
      .seccion { margin-bottom: 4mm; }
      .seccion-titulo { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 2mm; }
      .fila { display: flex; justify-content: space-between; padding: 1.5mm 0; font-size: 12px; }
      .fila .label { font-weight: 700; color: #374151; }
      .fila .valor { font-weight: 400; text-align: right; max-width: 60%; }
      .remitente { background: #f3f4f6; padding: 3mm; border-radius: 3mm; margin-bottom: 4mm; }
      .remitente-titulo { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 1mm; }
      .remitente-nombre { font-size: 15px; font-weight: 900; color: #111827; }
      .destino { border: 2px solid #111827; padding: 3mm; border-radius: 3mm; margin-bottom: 4mm; }
      .destino-titulo { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #6b7280; margin-bottom: 1mm; }
      .destino-nombre { font-size: 16px; font-weight: 900; color: #111827; margin-bottom: 1mm; }
      .destino-dato { font-size: 12px; color: #374151; margin-top: 0.5mm; }
      .footer { text-align: center; margin-top: 6mm; font-size: 9px; color: #9ca3af; }
      @media print { body { margin: 0; } }
    </style></head><body>
      <div class="header">
        <h1>MERCADOLIBRE</h1>
        <h2>GUÍA DE ENVÍO</h2>
      </div>
      <div class="divider"></div>
      <div class="remitente">
        <div class="remitente-titulo">Remitente</div>
        <div class="remitente-nombre">Libreria Antártida</div>
      </div>
      <div class="destino">
        <div class="destino-titulo">Destinatario</div>
        <div class="destino-nombre">${comprador}</div>
        <div class="destino-dato">📞 ${telefono}</div>
        <div class="destino-dato">📍 ${direccion}</div>
        <div class="destino-dato">🚚 Tracking: ${tracking}</div>
      </div>
      <div class="divider"></div>
      <div class="seccion">
        <div class="fila">
          <span class="label">Nº de orden ML</span>
          <span class="valor">#${venta.id}</span>
        </div>
        <div class="fila">
          <span class="label">Fecha</span>
          <span class="valor">${fecha}</span>
        </div>
        <div class="fila">
          <span class="label">Estado de pago</span>
          <span class="valor">${venta.status || '—'}</span>
        </div>
      </div>
      ${items ? `<div class="divider"></div><div class="seccion"><div class="seccion-titulo">Productos</div>${items}</div>` : ''}
      <div class="footer">MercadoLibre — Guía de envío</div>
    </body>
    <script>window.onload = function() { window.print(); window.close(); };<\/script>
    </html>`);
    printWindow.document.close();
  };

  // Facturar (placeholder - se implementara despues)
  const facturarVenta = (venta: MLVenta) => {
    toast.avisar('Función de facturación pendiente de implementar.', 'info');
  };

  const cardStyle = { backgroundColor: theme.card, padding: '20px', borderRadius: '16px', border: `1px solid ${theme.border}` };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* PESTAÑAS */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['conectar', 'productos', 'ventas'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.9rem',
              backgroundColor: tab === t ? '#ffe600' : theme.card,
              color: tab === t ? '#000' : theme.text,
              border: `1px solid ${tab === t ? '#ffe600' : theme.border}`
            }}
          >
            {t === 'conectar' && '🔗 Conectar'}
            {t === 'productos' && '📦 Productos'}
            {t === 'ventas' && '🛒 Ventas'}
          </button>
        ))}
      </div>

      {/* TAB: CONECTAR */}
      {tab === 'conectar' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', color: theme.text, fontWeight: 800, fontSize: '1.2rem' }}>🔗 Conexión con MercadoLibre</h3>

          {!credencialesConfiguradas && (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: darkMode ? '#7f1d1d' : '#fee2e2', border: '1px solid #ef4444', color: darkMode ? '#fca5a5' : '#991b1b', marginBottom: '16px', fontSize: '0.9rem' }}>
              ⚠️ Faltan las credenciales de MercadoLibre. Agregá en <code>.env.local</code>:
              <br /><code>NEXT_PUBLIC_ML_APP_ID=tu_app_id</code>
              <br /><code>NEXT_PUBLIC_ML_SECRET_KEY=tu_secret_key</code>
              <br /><code>NEXT_PUBLIC_ML_REDIRECT_URI=https://tu-dominio.com/mercadolibre/callback</code>
              <br />Registrá la app en <a href="https://developers.mercadolibre.com.ar/" target="_blank" style={{ color: '#3b82f6' }}>developers.mercadolibre.com.ar</a>
            </div>
          )}

          {cargando ? (
            <p style={{ color: theme.subtext }}>Cargando...</p>
          ) : token?.access_token ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: darkMode ? '#064e3b' : '#d1fae5', border: '1px solid #10b981', color: darkMode ? '#6ee7b7' : '#065f46' }}>
                ✅ Conectado como: <strong>{token.nickname || 'Usuario ML'}</strong> (ID: {token.user_id_ml})
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { cargarProductos(); setTab('productos'); }}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#ffe600', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  📦 Ver productos
                </button>
                <button
                  onClick={() => { cargarVentas(); setTab('ventas'); }}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#ffe600', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🛒 Ver ventas
                </button>
                <button
                  onClick={desconectar}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  🔌 Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
              <p style={{ color: theme.subtext, fontSize: '0.9rem', margin: 0 }}>
                Conectá tu cuenta de MercadoLibre para gestionar productos y ventas desde acá.
              </p>
              {urlAuth() ? (
                <a
                  href={urlAuth()!}
                  style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#ffe600', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', textDecoration: 'none', display: 'inline-block' }}
                >
                  🔗 Conectar con MercadoLibre
                </a>
              ) : (
                <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>Configurá las credenciales primero.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: PRODUCTOS */}
      {tab === 'productos' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: theme.text, fontWeight: 800, fontSize: '1.2rem' }}>📦 Publicaciones de MercadoLibre</h3>
            <button
              onClick={cargarProductos}
              disabled={cargandoProductos}
              style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#ffe600', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', opacity: cargandoProductos ? 0.6 : 1 }}
            >
              {cargandoProductos ? '⏳ Cargando...' : '🔄 Sincronizar'}
            </button>
          </div>

          {!token?.access_token ? (
            <p style={{ color: theme.subtext }}>Conectá tu cuenta de MercadoLibre primero.</p>
          ) : cargandoProductos ? (
            <p style={{ color: theme.subtext }}>Cargando publicaciones...</p>
          ) : productos.length === 0 ? (
            <p style={{ color: theme.subtext }}>No se encontraron publicaciones.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {productos.map((prod) => (
                <div key={prod.id} style={{ padding: '14px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.innerBox, display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {prod.thumbnail && <img src={prod.thumbnail} alt="" style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '8px', background: '#fff' }} />}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: 700, color: theme.text, fontSize: '0.95rem' }}>{prod.title}</div>
                    <div style={{ fontSize: '0.8rem', color: theme.subtext, marginTop: '4px' }}>
                      <span style={{ fontFamily: 'monospace' }}>{prod.id}</span> · ${prod.price.toLocaleString('es-AR')} · Stock: {prod.available_quantity} · Vendidos: {prod.sold_quantity || 0}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: prod.status === 'active' ? '#d1fae5' : prod.status === 'paused' ? '#fef3c7' : '#fee2e2',
                        color: prod.status === 'active' ? '#065f46' : prod.status === 'paused' ? '#92400e' : '#991b1b'
                      }}>
                        {prod.status === 'active' ? 'Activa' : prod.status === 'paused' ? 'Pausada' : prod.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {prod.status === 'active' ? (
                      <button onClick={() => cambiarEstadoProducto(prod.id, 'paused')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #f59e0b', background: 'transparent', color: '#f59e0b', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>⏸️ Pausar</button>
                    ) : (
                      <button onClick={() => cambiarEstadoProducto(prod.id, 'active')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #10b981', background: 'transparent', color: '#10b981', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>▶️ Activar</button>
                    )}
                    <button onClick={() => eliminarProducto(prod.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>🗑️ Cerrar</button>
                    <a href={prod.permalink} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'none' }}>🔗 Ver en ML</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: VENTAS */}
      {tab === 'ventas' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: theme.text, fontWeight: 800, fontSize: '1.2rem' }}>🛒 Ventas de MercadoLibre</h3>
            <button
              onClick={cargarVentas}
              disabled={cargandoVentas}
              style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#ffe600', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', opacity: cargandoVentas ? 0.6 : 1 }}
            >
              {cargandoVentas ? '⏳ Cargando...' : '🔄 Sincronizar'}
            </button>
          </div>

          {!token?.access_token ? (
            <p style={{ color: theme.subtext }}>Conectá tu cuenta de MercadoLibre primero.</p>
          ) : cargandoVentas ? (
            <p style={{ color: theme.subtext }}>Cargando ventas...</p>
          ) : ventas.length === 0 ? (
            <p style={{ color: theme.subtext }}>No se encontraron ventas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ventas.map((venta) => (
                <div key={venta.id} style={{ padding: '14px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.innerBox, cursor: 'pointer' }} onClick={() => setVentaSeleccionada(venta)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: theme.text, fontSize: '0.95rem' }}>Orden #{venta.id}</div>
                      <div style={{ fontSize: '0.8rem', color: theme.subtext, marginTop: '4px' }}>
                        {venta.buyer?.nickname || 'Comprador'} · ${venta.total_amount?.toLocaleString('es-AR')} · {new Date(venta.date_created).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: venta.status === 'paid' ? '#d1fae5' : venta.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                        color: venta.status === 'paid' ? '#065f46' : venta.status === 'cancelled' ? '#991b1b' : '#92400e'
                      }}>
                        {venta.status === 'paid' ? 'Pagado' : venta.status === 'cancelled' ? 'Cancelado' : venta.status}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); imprimirGuia(venta); }}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #6366f1', background: 'transparent', color: '#6366f1', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        🚚 Guía
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); facturarVenta(venta); }}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #10b981', background: 'transparent', color: '#10b981', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        📄 Facturar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DETALLE DE VENTA SELECCIONADA */}
          {ventaSeleccionada && (
            <div style={{ padding: '16px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.innerBox, marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: theme.text, fontWeight: 800 }}>Detalle de orden #{ventaSeleccionada.id}</h4>
                <button onClick={() => setVentaSeleccionada(null)} style={{ background: 'none', border: 'none', color: theme.subtext, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>
              <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                <strong>Comprador:</strong> {ventaSeleccionada.buyer?.nickname || '—'}
              </div>
              {ventaSeleccionada.buyer?.email && (
                <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                  <strong>Email:</strong> {ventaSeleccionada.buyer.email}
                </div>
              )}
              {ventaSeleccionada.buyer?.phone?.number && (
                <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                  <strong>Teléfono:</strong> {ventaSeleccionada.buyer.phone.number}
                </div>
              )}
              {ventaSeleccionada.shipping && (
                <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                  <strong>Envío:</strong> {ventaSeleccionada.shipping.status} {ventaSeleccionada.shipping.tracking_number ? `(Tracking: ${ventaSeleccionada.shipping.tracking_number})` : ''}
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                <strong>Total:</strong> ${ventaSeleccionada.total_amount?.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: '0.85rem', color: theme.text, marginBottom: '8px' }}>
                <strong>Estado de pago:</strong> {ventaSeleccionada.status}
              </div>
              {ventaSeleccionada.order_items && (
                <div style={{ marginTop: '8px' }}>
                  <strong style={{ fontSize: '0.85rem', color: theme.text }}>Productos:</strong>
                  {ventaSeleccionada.order_items.map((it, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', color: theme.subtext, marginLeft: '12px', marginTop: '4px' }}>
                      {it.quantity}x {it.item?.title} — ${ (it.unit_price * it.quantity).toLocaleString('es-AR') }
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => imprimirGuia(ventaSeleccionada)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #6366f1', background: 'transparent', color: '#6366f1', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  🚚 Imprimir guía
                </button>
                <button
                  onClick={() => facturarVenta(ventaSeleccionada)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #10b981', background: 'transparent', color: '#10b981', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  📄 Facturar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}