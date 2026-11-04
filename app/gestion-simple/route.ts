import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vouedymblcmranmccpjy.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_EUH9ifNYpstq4vmYEya9-g_Erp_geVx';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Gestión Simple - iPad</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: rgba(0,0,0,0.1); }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; color: #0f172a; font-size: 16px; }

  /* Header */
  .header { background: #1e293b; color: #fff; padding: 10px 14px; position: sticky; top: 0; z-index: 20; }
  .header h1 { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
  .tabs { display: flex; }
  .tab-btn { flex: 1; padding: 10px 8px; background: #334155; color: #cbd5e1; border: none; font-size: 15px; font-weight: 700; cursor: pointer; border-radius: 8px 8px 0 0; margin-right: 4px; }
  .tab-btn:last-child { margin-right: 0; }
  .tab-btn.active { background: #3b82f6; color: #fff; }
  .tab-btn:active { opacity: 0.8; }

  /* Search */
  .search-wrap { padding: 8px 14px; background: #1e293b; }
  .search { width: 100%; padding: 12px 16px; border: none; border-radius: 10px; font-size: 18px; outline: none; }
  .count { font-size: 13px; color: #94a3b8; margin-top: 6px; text-align: center; }

  /* Content */
  .content { padding: 8px; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* Stock cards */
  .card { background: #fff; border-radius: 12px; margin-bottom: 8px; padding: 12px; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; min-height: 72px; }
  .card:active { background: #e2e8f0; }
  .card img { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: #f8fafc; flex-shrink: 0; margin-right: 12px; }
  .card .info { flex: 1; min-width: 0; }
  .card .nombre { font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card .codigo { font-family: monospace; font-size: 13px; color: #6474b; margin-top: 2px; }
  .card .precio { font-weight: 800; color: #16a34a; font-size: 17px; margin-top: 2px; }
  .card .det { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .empty { text-align: center; padding: 40px 20px; color: #64748b; font-size: 16px; }
  .loading { text-align: center; padding: 40px; color: #64748b; }

  /* Pedidos */
  .pedido-card { background: #fff; border-radius: 12px; margin-bottom: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; }
  .pedido-card:active { background: #e2e8f0; }
  .pedido-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .pedido-nombre { font-weight: 800; font-size: 16px; }
  .pedido-estado { padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; }
  .estado-pendiente { background: #fef3c7; color: #92400e; }
  .estado-preparando { background: #dbeafe; color: #1e40af; }
  .estado-completado { background: #dcfce7; color: #166534; }
  .pedido-info { font-size: 13px; color: #64748b; margin-top: 2px; }
  .pedido-total { font-weight: 800; font-size: 18px; color: #16a34a; margin-top: 6px; }
  .filtro-row { display: flex; gap: 6px; padding: 8px 14px; background: #1e293b; overflow-x: auto; }
  .filtro-btn { padding: 8px 14px; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; background: #334155; color: #cbd5e1; white-space: nowrap; flex-shrink: 0; }
  .filtro-btn.active { background: #3b82f6; color: #fff; }

  /* Modal */
  .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: none; align-items: center; justify-content: center; padding: 12px; }
  .modal-bg.show { display: flex; }
  .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; padding: 16px; }
  .modal h2 { font-size: 20px; font-weight: 800; margin-bottom: 12px; }
  .modal img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; background: #f8fafc; margin-bottom: 12px; }
  .modal .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px; }
  .modal .row .label { color: #64748b; font-weight: 600; }
  .modal .row .value { font-weight: 700; text-align: right; max-width: 60%; }
  .modal .section { font-weight: 800; font-size: 14px; color: #3b82f6; margin: 12px 0 6px; }
  .modal .variedad { background: #f1f5f9; border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; }
  .modal .variedad .nom { font-weight: 700; font-size: 15px; }
  .modal .variedad .det { font-size: 12px; color: #64748b; margin-top: 2px; }
  .modal .item { background: #f8fafc; border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; border: 1px solid #e2e8f0; }
  .modal .item .nom { font-weight: 700; font-size: 15px; }
  .modal .item .det { font-size: 13px; color: #64748b; margin-top: 2px; }
  .modal .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: 800; margin-top: 8px; cursor: pointer; }
  .modal .btn:active { opacity: 0.8; }
  .btn-blue { background: #3b82f6; color: #fff; }
  .btn-green { background: #16a34a; color: #fff; }
  .btn-gray { background: #64748b; color: #fff; }
  .btn-close { background: #e2e8f0; color: #0f172a; }
  .modal input, .modal select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; margin-top: 4px; margin-bottom: 8px; }
  .modal label { font-size: 13px; font-weight: 700; color: #64748b; display: block; margin-top: 8px; }
  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #1e293b; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; z-index: 200; display: none; max-width: 90%; text-align: center; }
  .toast.show { display: block; }
  .toast.error { background: #dc2626; }
  .toast.ok { background: #16a34a; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
  .badge-oculto { background: #fef3c7; color: #92400e; }
  .badge-sinstock { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>

<div class="header">
  <h1>📱 Gestión Simple</h1>
  <div class="tabs">
    <button class="tab-btn active" id="tabStock" onclick="cambiarTab('stock')">📦 Stock</button>
    <button class="tab-btn" id="tabPedidos" onclick="cambiarTab('pedidos')">🛒 Pedidos Web</button>
  </div>
</div>

<!-- TAB STOCK -->
<div class="search-wrap" id="searchWrapStock">
  <input type="text" class="search" id="searchStock" placeholder="Buscar por nombre, código o variedad..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
  <div class="count" id="countStock"></div>
</div>
<div class="content">
  <div class="tab-content active" id="contentStock">
    <div id="listStock"><div class="loading">Cargando productos...</div></div>
  </div>

  <!-- TAB PEDIDOS -->
  <div class="tab-content" id="contentPedidos">
    <div class="filtro-row">
      <button class="filtro-btn active" data-filtro="todos" onclick="filtrarPedidos('todos')">Todos</button>
      <button class="filtro-btn" data-filtro="pendiente" onclick="filtrarPedidos('pendiente')">Pendientes</button>
      <button class="filtro-btn" data-filtro="preparando" onclick="filtrarPedidos('preparando')">Preparando</button>
      <button class="filtro-btn" data-filtro="completado" onclick="filtrarPedidos('completado')">Completados</button>
    </div>
    <div id="listPedidos"><div class="loading">Cargando pedidos...</div></div>
  </div>
</div>

<div class="modal-bg" id="modalBg">
  <div class="modal" id="modal"></div>
</div>

<div class="toast" id="toast"></div>

<script>
var SUPABASE_URL = '${SUPABASE_URL}';
var SUPABASE_KEY = '${SUPABASE_KEY}';

function api(path, opts) {
  opts = opts || {};
  var headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (opts.headers) { for (var k in opts.headers) headers[k] = opts.headers[k]; }
  return fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
}

function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var toastTimer = null;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.className = 'toast'; }, 2500);
}

/* ============ TABS ============ */
function cambiarTab(tab) {
  document.getElementById('tabStock').className = 'tab-btn' + (tab === 'stock' ? ' active' : '');
  document.getElementById('tabPedidos').className = 'tab-btn' + (tab === 'pedidos' ? ' active' : '');
  document.getElementById('contentStock').className = 'tab-content' + (tab === 'stock' ? ' active' : '');
  document.getElementById('contentPedidos').className = 'tab-content' + (tab === 'pedidos' ? ' active' : '');
  document.getElementById('searchWrapStock').style.display = tab === 'stock' ? 'block' : 'none';
  if (tab === 'pedidos' && pedidos.length === 0) cargarPedidos();
}

/* ============ STOCK ============ */
var productos = [];
var filtradosStock = [];
var productoEditando = null;

function cargarProductos() {
  api('stock?select=*&order=nombre.asc').then(function(r) { return r.json(); }).then(function(data) {
    productos = Array.isArray(data) ? data : [];
    filtrarStock();
  }).catch(function(e) {
    document.getElementById('listStock').innerHTML = '<div class="empty">Error al cargar: ' + esc(e.message || e) + '</div>';
  });
}

function filtrarStock() {
  var term = document.getElementById('searchStock').value.trim().toLowerCase();
  if (!term) { filtradosStock = productos.slice(); }
  else {
    filtradosStock = productos.filter(function(p) {
      if (String(p.nombre || '').toLowerCase().indexOf(term) !== -1) return true;
      if (String(p.codigo || '').toLowerCase().indexOf(term) !== -1) return true;
      var vars = Array.isArray(p.variedades) ? p.variedades : [];
      for (var i = 0; i < vars.length; i++) {
        if (String(vars[i].nombre || '').toLowerCase().indexOf(term) !== -1) return true;
        if (String(vars[i].codigo || '').toLowerCase().indexOf(term) !== -1) return true;
      }
      return false;
    });
  }
  renderStock();
}

function renderStock() {
  var el = document.getElementById('listStock');
  document.getElementById('countStock').textContent = filtradosStock.length + ' producto(s)';
  if (filtradosStock.length === 0) { el.innerHTML = '<div class="empty">Sin resultados</div>'; return; }
  var html = '';
  for (var i = 0; i < filtradosStock.length; i++) {
    var p = filtradosStock[i];
    var precio = p.precio_minorista || p.precio_mayorista || 0;
    var img = p.imagen_url ? '<img src="' + p.imagen_url + '" alt="">' : '<div style="width:56px;height:56px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;">📦</div>';
    var badges = '';
    if (p.sin_stock) badges += ' <span class="badge badge-sinstock">Sin stock</span>';
    if (p.visible_web === false) badges += ' <span class="badge badge-oculto">Oculto</span>';
    html += '<div class="card" data-id="' + p.id + '">' +
      img +
      '<div class="info">' +
        '<div class="nombre">' + esc(p.nombre || 'Sin nombre') + badges + '</div>' +
        '<div class="codigo">' + (p.codigo || '—') + '</div>' +
        '<div class="precio">$' + fmt(precio) + '</div>' +
        '<div class="det">Mayorista: $' + fmt(p.precio_mayorista) + ' · Costo: $' + fmt(p.precio_costo) + '</div>' +
      '</div>' +
    '</div>';
  }
  el.innerHTML = html;
  var cards = el.querySelectorAll('.card');
  for (var j = 0; j < cards.length; j++) {
    cards[j].onclick = function() {
      var id = this.getAttribute('data-id');
      var prod = productos.filter(function(p) { return String(p.id) === String(id); })[0];
      if (prod) mostrarDetalleStock(prod);
    };
  }
}

function mostrarDetalleStock(p) {
  productoEditando = p;
  var modal = document.getElementById('modal');
  var img = p.imagen_url ? '<img src="' + p.imagen_url + '" alt="">' : '';
  var vars = Array.isArray(p.variedades) ? p.variedades : [];
  var varHtml = '';
  if (vars.length > 0) {
    varHtml = '<div class="section">Variedades (' + vars.length + ')</div>';
    for (var i = 0; i < vars.length; i++) {
      var v = vars[i];
      varHtml += '<div class="variedad">' +
        '<div class="nom">' + esc(v.nombre || 'Sin nombre') + '</div>' +
        '<div class="det">Código: ' + (v.codigo || p.codigo || '—') + ' · Costo: $' + fmt(v.precio_costo != null ? v.precio_costo : p.precio_costo) + ' · Mayorista: $' + fmt(v.precio_mayorista != null ? v.precio_mayorista : p.precio_mayorista) + ' · Minorista: $' + fmt(v.precio_minorista != null ? v.precio_minorista : p.precio_minorista) + '</div>' +
      '</div>';
    }
  }
  var html = img +
    '<h2>' + esc(p.nombre || 'Sin nombre') + '</h2>' +
    '<label>Nombre</label>' +
    '<input type="text" id="editNombre" value="' + esc(p.nombre || '') + '">' +
    '<label>Código de barras</label>' +
    '<input type="text" id="editCodigo" value="' + esc(p.codigo || '') + '" style="font-family:monospace;">' +
    '<label>Costo</label>' +
    '<input type="number" id="editCosto" value="' + (p.precio_costo || 0) + '">' +
    '<label>IVA %</label>' +
    '<input type="number" id="editIva" value="' + (p.precio_iva || 0) + '">' +
    '<label>Mayorista</label>' +
    '<input type="number" id="editMayorista" value="' + (p.precio_mayorista || 0) + '">' +
    '<label>Minorista</label>' +
    '<input type="number" id="editMinorista" value="' + (p.precio_minorista || 0) + '">' +
    '<label>Promo</label>' +
    '<input type="text" id="editPromo" value="' + esc(p.precio_promo || '') + '">' +
    varHtml +
    '<button class="btn btn-green" onclick="guardarEdicion()">💾 Guardar cambios</button>' +
    '<button class="btn btn-close" onclick="cerrarModal()">Cerrar</button>';
  modal.innerHTML = html;
  document.getElementById('modalBg').className = 'modal-bg show';
}

function guardarEdicion() {
  if (!productoEditando) return;
  var btn = document.querySelector('.btn-green');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  var cambios = {
    nombre: document.getElementById('editNombre').value.trim(),
    codigo: document.getElementById('editCodigo').value.trim() || null,
    precio_costo: Number(document.getElementById('editCosto').value) || 0,
    precio_iva: Number(document.getElementById('editIva').value) || 0,
    precio_mayorista: Number(document.getElementById('editMayorista').value) || 0,
    precio_minorista: Number(document.getElementById('editMinorista').value) || 0,
    precio_promo: document.getElementById('editPromo').value.trim() || null
  };
  api('stock?id=eq.' + productoEditando.id, { method: 'PATCH', body: cambios, headers: { 'Prefer': 'return=representation' } }).then(function(r) {
    if (!r.ok) throw new Error('Error ' + r.status);
    return r.json();
  }).then(function(data) {
    var actualizado = Array.isArray(data) ? data[0] : data;
    if (actualizado) {
      // actualizar en memoria
      for (var i = 0; i < productos.length; i++) {
        if (String(productos[i].id) === String(productoEditando.id)) {
          for (var k in cambios) productos[i][k] = cambios[k];
          productos[i].nombre = cambios.nombre;
          break;
        }
      }
    }
    showToast('Producto actualizado', 'ok');
    cerrarModal();
    filtrarStock();
  }).catch(function(e) {
    showToast('Error al guardar: ' + (e.message || e), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
  });
}

document.getElementById('searchStock') && (document.getElementById('searchStock').oninput = filtrarStock);
document.getElementById('searchStock') && (document.getElementById('searchStock').onkeydown = function(e) {
  if (e.key === 'Enter') {
    var term = this.value.trim().toLowerCase();
    if (term.length < 2) return;
    var match = productos.filter(function(p) {
      if (String(p.codigo || '').toLowerCase() === term) return true;
      var vars = Array.isArray(p.variedades) ? p.variedades : [];
      for (var i = 0; i < vars.length; i++) {
        if (String(vars[i].codigo || '').toLowerCase() === term) return true;
      }
      return false;
    })[0];
    if (match) { mostrarDetalleStock(match); this.value = ''; filtrarStock(); }
  }
});

/* ============ PEDIDOS WEB ============ */
var pedidos = [];
var filtroPedido = 'todos';
var pedidoSeleccionado = null;

function cargarPedidos() {
  document.getElementById('listPedidos').innerHTML = '<div class="loading">Cargando pedidos...</div>';
  api('pedidos_web?select=*&order=created_at.desc').then(function(r) { return r.json(); }).then(function(data) {
    pedidos = Array.isArray(data) ? data : [];
    renderPedidos();
  }).catch(function(e) {
    document.getElementById('listPedidos').innerHTML = '<div class="empty">Error: ' + esc(e.message || e) + '</div>';
  });
}

function filtrarPedidos(filtro) {
  filtroPedido = filtro;
  var btns = document.querySelectorAll('.filtro-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].className = 'filtro-btn' + (btns[i].getAttribute('data-filtro') === filtro ? ' active' : '');
  }
  renderPedidos();
}

function renderPedidos() {
  var el = document.getElementById('listPedidos');
  var lista = pedidos;
  if (filtroPedido !== 'todos') {
    lista = pedidos.filter(function(p) { return p.estado === filtroPedido; });
  }
  if (lista.length === 0) { el.innerHTML = '<div class="empty">Sin pedidos</div>'; return; }
  var html = '';
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    var estado = p.estado || 'pendiente';
    var badgeClass = estado === 'pendiente' ? 'estado-pendiente' : estado === 'preparando' ? 'estado-preparando' : 'estado-completado';
    var fecha = p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—';
    var items = Array.isArray(p.productos) ? p.productos : [];
    html += '<div class="pedido-card" data-id="' + p.id + '">' +
      '<div class="pedido-header">' +
        '<span class="pedido-nombre">' + esc(p.nombre || 'Sin nombre') + '</span>' +
        '<span class="pedido-estado ' + badgeClass + '">' + estado + '</span>' +
      '</div>' +
      '<div class="pedido-info">' + fecha + ' · ' + items.length + ' producto(s) · ' + (p.metodo_envio || '—') + '</div>' +
      '<div class="pedido-info">' + esc(p.telefono || '') + (p.direccion ? ' · ' + esc(p.direccion) : '') + '</div>' +
      '<div class="pedido-total">$' + fmt(p.total) + '</div>' +
    '</div>';
  }
  el.innerHTML = html;
  var cards = el.querySelectorAll('.pedido-card');
  for (var j = 0; j < cards.length; j++) {
    cards[j].onclick = function() {
      var id = this.getAttribute('data-id');
      var ped = pedidos.filter(function(p) { return String(p.id) === String(id); })[0];
      if (ped) mostrarDetallePedido(ped);
    };
  }
}

function mostrarDetallePedido(p) {
  pedidoSeleccionado = p;
  var modal = document.getElementById('modal');
  var items = Array.isArray(p.productos) ? p.productos : [];
  var itemsHtml = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var nombre = it.producto ? it.producto.nombre : (it.nombre || 'Producto');
    var variedad = it.variedad ? it.variedad.nombre : '';
    var cant = it.cantidad_pedida || it.cantidad || it.unidades || 1;
    var precio = it.producto ? it.producto.precio : (it.precio || 0);
    itemsHtml += '<div class="item">' +
      '<div class="nom">' + esc(nombre) + (variedad ? ' · ' + esc(variedad) : '') + '</div>' +
      '<div class="det">Cant: ' + cant + ' · Precio: $' + fmt(precio) + ' · Subtotal: $' + fmt(precio * cant) + '</div>' +
    '</div>';
  }
  var estado = p.estado || 'pendiente';
  var html = '<h2>Pedido #' + p.id + '</h2>' +
    '<div class="row"><span class="label">Cliente</span><span class="value">' + esc(p.nombre || '—') + '</span></div>' +
    '<div class="row"><span class="label">Teléfono</span><span class="value">' + esc(p.telefono || '—') + '</span></div>' +
    '<div class="row"><span class="label">Envío</span><span class="value">' + esc(p.metodo_envio || '—') + '</span></div>' +
    (p.direccion ? '<div class="row"><span class="label">Dirección</span><span class="value">' + esc(p.direccion) + '</span></div>' : '') +
    '<div class="row"><span class="label">Fecha</span><span class="value">' + (p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—') + '</span></div>' +
    '<div class="row"><span class="label">Estado</span><span class="value">' + estado + '</span></div>' +
    '<div class="row"><span class="label">Total</span><span class="value" style="color:#16a34a;">$' + fmt(p.total) + '</span></div>' +
    '<div class="section">Productos (' + items.length + ')</div>' +
    itemsHtml +
    (p.vendedor ? '<div class="row"><span class="label">Vendedor</span><span class="value">' + esc(p.vendedor) + '</span></div>' : '');
  // Action buttons
  if (estado === 'pendiente') {
    html += '<button class="btn btn-blue" data-accion="preparando">🔵 Marcar preparando</button>';
  }
  if (estado === 'preparando') {
    html += '<button class="btn btn-green" data-accion="completado">✅ Marcar completado</button>';
  }
  if (estado === 'completado') {
    html += '<div style="text-align:center;padding:12px;color:#16a34a;font-weight:800;">✅ Pedido completado</div>';
  }
  html += '<button class="btn btn-close" onclick="cerrarModal()">Cerrar</button>';
  modal.innerHTML = html;
  // Attach action button handlers
  var actionBtns = modal.querySelectorAll('[data-accion]');
  for (var ab = 0; ab < actionBtns.length; ab++) {
    actionBtns[ab].onclick = function() { marcarEstado(this.getAttribute('data-accion')); };
  }
  document.getElementById('modalBg').className = 'modal-bg show';
}

function marcarEstado(nuevoEstado) {
  if (!pedidoSeleccionado) return;
  var btns = document.querySelectorAll('.btn-blue, .btn-green');
  for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].textContent = 'Guardando...'; }
  api('pedidos_web?id=eq.' + pedidoSeleccionado.id, { method: 'PATCH', body: { estado: nuevoEstado }, headers: { 'Prefer': 'return=representation' } }).then(function(r) {
    if (!r.ok) throw new Error('Error ' + r.status);
    return r.json();
  }).then(function(data) {
    var actualizado = Array.isArray(data) ? data[0] : data;
    // actualizar en memoria
    for (var i = 0; i < pedidos.length; i++) {
      if (String(pedidos[i].id) === String(pedidoSeleccionado.id)) {
        pedidos[i].estado = nuevoEstado;
        if (actualizado && actualizado.estado) pedidos[i].estado = actualizado.estado;
        break;
      }
    }
    pedidoSeleccionado.estado = nuevoEstado;
    if (actualizado && actualizado.estado) pedidoSeleccionado.estado = actualizado.estado;
    showToast('Estado actualizado a: ' + nuevoEstado, 'ok');
    cerrarModal();
    renderPedidos();
  }).catch(function(e) {
    showToast('Error: ' + (e.message || e), 'error');
    var btns2 = document.querySelectorAll('.btn-blue, .btn-green');
    for (var i = 0; i < btns2.length; i++) { btns2[i].disabled = false; }
  });
}

function cerrarModal() {
  document.getElementById('modalBg').className = 'modal-bg';
  productoEditando = null;
  pedidoSeleccionado = null;
}

document.getElementById('modalBg').onclick = function(e) {
  if (e.target === this) cerrarModal();
};

/* Init */
document.getElementById('searchStock').oninput = filtrarStock;
document.getElementById('searchStock').onkeydown = function(e) {
  if (e.key === 'Enter') {
    var term = this.value.trim().toLowerCase();
    if (term.length < 2) return;
    var match = productos.filter(function(p) {
      if (String(p.codigo || '').toLowerCase() === term) return true;
      var vars = Array.isArray(p.variedades) ? p.variedades : [];
      for (var i = 0; i < vars.length; i++) {
        if (String(vars[i].codigo || '').toLowerCase() === term) return true;
      }
      return false;
    })[0];
    if (match) { mostrarDetalleStock(match); this.value = ''; filtrarStock(); }
  }
};

cargarProductos();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}