"use client";

import React, { useState } from 'react';

/* Piezas de DISEÑO compartidas por los dos puntos de venta (mayorista y
   minorista), para que las dos pantallas se vean igual sin duplicar código.
   Acá NO vive ninguna lógica de negocio: precios, promos, cuenta corriente e
   historiales siguen en Ventas.tsx y VentasMayoristas.tsx. */

export type TonosPos = {
  /** Fondo de los controles (cajas internas del tema). */
  fondo: string;
  borde: string;
  texto: string;
  subtexto: string;
  acento: string;
};

type StepperProps = {
  valor: number;
  onCambio: (n: number) => void;
  tono: TonosPos;
  min?: number;
  max?: number;
  /** Ancho del cuadro de número, en px (alcanza para 4 dígitos con ancho 64). */
  ancho?: number;
  alto?: number;
  etiqueta?: string;
  /** Al restar por debajo del mínimo se invoca (en el carrito: borra la línea). */
  onLlegarAlMinimo?: () => void;
};

/**
 * Cuadro de cantidad: entrada manual o con botones − / +, los dos caminos
 * válidos. Muestra hasta 4 dígitos (9999) y mientras se escribe a mano deja
 * borrar el campo, así se puede tipear "1200" sin que cada tecla quede
 * normalizada; al salir del campo o al tocar −/+ vuelve al valor normalizado.
 */
export function StepperCantidad({
  valor, onCambio, tono, min = 1, max = 9999, ancho = 64, alto = 44, etiqueta, onLlegarAlMinimo
}: StepperProps) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const texto = borrador ?? String(valor);
  const limitar = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

  const escribir = (crudo: string) => {
    const soloDigitos = crudo.replace(/\D/g, '').slice(0, 4);
    setBorrador(soloDigitos);
    onCambio(soloDigitos === '' ? min : limitar(parseInt(soloDigitos, 10)));
  };

  const paso = (delta: number) => {
    if (delta < 0 && valor <= min && onLlegarAlMinimo) { setBorrador(null); onLlegarAlMinimo(); return; }
    setBorrador(null);
    onCambio(limitar(valor + delta));
  };

  const boton = (delta: number, signo: string, titulo: string) => {
    const deshabilitado = delta < 0 ? valor <= min && !onLlegarAlMinimo : valor >= max;
    return (
      <button
        type="button"
        onClick={() => paso(delta)}
        title={titulo}
        aria-label={titulo}
        disabled={deshabilitado}
        style={{
          width: `${alto}px`, height: `${alto}px`, border: 'none', background: 'transparent',
          color: tono.texto, cursor: deshabilitado ? 'not-allowed' : 'pointer',
          fontSize: `${Math.round(alto * 0.45)}px`, fontWeight: 900, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: deshabilitado ? 0.35 : 1, flexShrink: 0, transition: 'color .15s ease'
        }}
        onMouseEnter={(e: any) => { if (!deshabilitado) e.currentTarget.style.color = tono.acento; }}
        onMouseLeave={(e: any) => { e.currentTarget.style.color = tono.texto; }}
      >
        {signo}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', backgroundColor: tono.fondo,
      border: `1px solid ${tono.borde}`, borderRadius: '12px', overflow: 'hidden',
      height: `${alto}px`, flexShrink: 0
    }}>
      {boton(-1, '−', 'Restar una unidad')}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={texto}
        onChange={e => escribir(e.target.value)}
        onBlur={() => setBorrador(null)}
        aria-label={etiqueta || 'Cantidad'}
        title={etiqueta || 'Cantidad'}
        style={{
          width: `${ancho}px`, height: '100%', border: 'none', outline: 'none',
          background: 'transparent', color: tono.texto, textAlign: 'center',
          fontSize: '16px', fontWeight: 800, padding: 0,
          fontVariantNumeric: 'tabular-nums'
        }}
      />
      {boton(1, '+', 'Sumar una unidad')}
    </div>
  );
}

type AjusteProps = {
  valor: string;
  onValor: (v: string) => void;
  /** Recibe 'recargo' | 'descuento' (la lógica vive en cada pantalla). */
  onAplicar: (tipo: 'recargo' | 'descuento') => void;
  tono: TonosPos;
  etiqueta: string;
  placeholder: string;
};

/** Control de % masivo: se elige recargo o descuento y se aplica al carrito. */
export function AjustePorcentual({ valor, onValor, onAplicar, tono, etiqueta, placeholder }: AjusteProps) {
  const btn = (tipo: 'recargo' | 'descuento', texto: string, color: string) => (
    <button
      type="button"
      onClick={() => onAplicar(tipo)}
      style={{
        flex: 1, padding: '11px 12px', backgroundColor: color, color: '#fff', border: 'none',
        borderRadius: '9px', fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap',
        minHeight: 42, transition: 'filter .15s ease'
      }}
      onMouseEnter={(e: any) => { e.currentTarget.style.filter = 'brightness(1.12)'; }}
      onMouseLeave={(e: any) => { e.currentTarget.style.filter = 'none'; }}
    >
      {texto}
    </button>
  );

  return (
    <div style={{
      backgroundColor: tono.fondo, padding: '14px', borderRadius: '12px',
      border: `1px dashed ${tono.borde}`, display: 'flex', flexDirection: 'column', gap: '10px'
    }}>
      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: tono.texto, letterSpacing: '0.3px' }}>
        {etiqueta}
      </label>
      <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexDirection: 'column' }}>
        <input
          type="number"
          inputMode="numeric"
          placeholder={placeholder}
          value={valor}
          onChange={e => onValor(e.target.value)}
          min="1"
          style={{
            width: '100%', padding: '11px 12px', borderRadius: '9px',
            border: `1px solid ${tono.borde}`, backgroundColor: tono.fondo, color: tono.texto,
            outline: 'none', fontSize: '16px', fontWeight: 700, boxSizing: 'border-box'
          }}
        />
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          {btn('recargo', '▲ Recargo %', '#3b82f6')}
          {btn('descuento', '▼ Descuento %', '#ef4444')}
        </div>
      </div>
    </div>
  );
}

export type LineaTicket = { unidades: number; nombre: string; importe: number };

const escapear = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Comprobante de venta de una sola carilla: encabezado (nombre del negocio,
 * fecha y hora, medio de pago y cliente si corresponde), lista de productos
 * con cantidad e importe, y al final el total. Sin subtotales ni descuentos.
 */
export function armarHTMLTicket(datos: {
  fecha: string;
  metodoPago: string;
  cliente?: string | null;
  items: LineaTicket[];
  total: number;
  /** Línea final opcional (por ejemplo el saldo de cuenta corriente). */
  pie?: string | null;
}): string {
  const filas = datos.items.map(i =>
    `<tr>
       <td class="cant">${Number(i.unidades || 0)} x</td>
       <td class="nom">${escapear(i.nombre)}</td>
       <td class="imp">$${Number(i.importe || 0).toLocaleString('es-AR')}</td>
     </tr>`).join('');

  return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { margin: 6mm; }
            body { font-family: 'Courier New', monospace; padding: 8px; font-size: 13px; font-weight: bold; color: #000; }
            .text-center { text-align: center; }
            h3 { margin: 0 0 5px; font-size: 16px; letter-spacing: 1px; }
            .meta { margin-top: 3px; }
            .divider { border-top: 2px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; vertical-align: top; word-break: break-word; }
            td.cant { white-space: nowrap; padding-right: 6px; }
            td.nom { }
            td.imp { text-align: right; white-space: nowrap; padding-left: 8px; }
            .total { font-size: 15px; font-weight: 900; margin-top: 4px; text-align: right; }
            .pie { margin-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3>DISTRIBUIDORA INDIA</h3>
            <div class="meta">${escapear(datos.fecha)}</div>
            <div class="meta">PAGO: ${escapear(String(datos.metodoPago || '').toUpperCase())}</div>
            ${datos.cliente ? `<div class="meta">CLIENTE: ${escapear(String(datos.cliente).toUpperCase())}</div>` : ''}
          </div>
          <div class="divider"></div>
          <table>${filas}</table>
          <div class="divider"></div>
          <div class="total">TOTAL: $${Number(datos.total || 0).toLocaleString('es-AR')}</div>
          ${datos.pie ? `<div class="pie">${escapear(datos.pie)}</div>` : ''}
          <script>window.onload = function() { window.print(); window.close(); };<\/script>
        </body>
      </html>
    `;
}
