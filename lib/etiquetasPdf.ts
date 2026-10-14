import type { jsPDF } from 'jspdf';
import { drawCode128EnPdf, normalizarCodigo } from './codigobarras.ts';

export type ProductoEtiqueta = {
  nombre?: string | null;
  codigo?: string | null;
  precio_minorista?: number | null;
  precio_mayorista?: number | null;
  precio_promo?: string | null;
  variedades?: { precio_minorista?: number | null }[] | null;
};

export const precioMinoristaDe = (item: ProductoEtiqueta): number => {
  const variedades = Array.isArray(item.variedades) ? item.variedades : [];
  const precios = variedades
    .map(v => Number(v.precio_minorista ?? item.precio_minorista))
    .filter(n => Number.isFinite(n));
  return precios.length > 0 ? Math.min(...precios) : Number(item.precio_minorista || 0);
};

const MARGEN = 8;
const COLUMNAS = 3;
const GAP_X = 4;
const GAP_Y = 4;
const ALTO_ETIQUETA = 31;

// Devuelve la promo a imprimir, o '' si el producto no tiene promo de verdad.
// En la base hay valores como "0", "-" o vacíos que no deben verse en la etiqueta.
export const promoVisible = (valor: unknown): string => {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  if (/^[-–—.\s]+$/.test(texto)) return '';
  if (/^0+([.,]0+)?$/.test(texto)) return '';
  return texto;
};

// Dibuja una hoja A4 (o más) con etiquetas recortables: nombre, código de
// barras, número, promo y precios minorista/mayorista. Devuelve cuántas dibujó.
export function dibujarEtiquetasEnDoc(doc: jsPDF, productos: ProductoEtiqueta[]): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cellW = (pageWidth - MARGEN * 2 - GAP_X * (COLUMNAS - 1)) / COLUMNAS;
  const filas = Math.floor((pageHeight - MARGEN * 2 + GAP_Y) / (ALTO_ETIQUETA + GAP_Y));
  const porPagina = COLUMNAS * filas;

  const dibujarEtiqueta = (item: ProductoEtiqueta, x: number, y: number) => {
    const promo = promoVisible(item.precio_promo);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1, 1], 0);
    doc.rect(x, y, cellW, ALTO_ETIQUETA);
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const crudo = doc.splitTextToSize(String(item.nombre || ''), cellW - 6);
    let lineas: string[] = Array.isArray(crudo) ? crudo.map(String) : [String(crudo)];
    if (lineas.length > 2) {
      const ultima = lineas[1];
      lineas = [lineas[0], ultima.slice(0, Math.max(1, ultima.length - 1)) + '…'];
    }
    doc.text(lineas, x + 3, y + 4.4);

    const anchoBC = cellW - 10;
    drawCode128EnPdf(doc, item.codigo, x + (cellW - anchoBC) / 2, y + 9, anchoBC, 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(normalizarCodigo(item.codigo), x + cellW / 2, y + 21.5, { align: 'center' });

    if (promo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(225, 29, 72);
      doc.text(`PROMO ${promo}`.toUpperCase(), x + cellW / 2, y + 25.3, { align: 'center' });
    }

    const textoMin = `Min $${precioMinoristaDe(item).toLocaleString('es-AR')}`;
    const textoMay = `May $${Number(item.precio_mayorista || 0).toLocaleString('es-AR')}`;
    const anchoUtil = cellW - 6;
    let fontMin = 13.5;
    let fontMay = 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontMin);
    const anchoMin = doc.getTextWidth(textoMin);
    doc.setFontSize(fontMay);
    const anchoMay = doc.getTextWidth(textoMay);
    const tope = anchoUtil - 3;
    if (anchoMin + anchoMay > tope) {
      const factor = tope / (anchoMin + anchoMay);
      fontMin *= factor;
      fontMay *= factor;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontMin);
    doc.setTextColor(22, 163, 74);
    doc.text(textoMin, x + 3, y + 30);

    doc.setFontSize(fontMay);
    doc.setTextColor(139, 92, 246);
    doc.text(textoMay, x + cellW - 3, y + 30, { align: 'right' });
  };

  let dibujadas = 0;
  productos.forEach(item => {
    if (!normalizarCodigo(item.codigo)) return;
    if (dibujadas > 0 && dibujadas % porPagina === 0) doc.addPage();
    const fila = Math.floor(dibujadas / COLUMNAS) % filas;
    const col = dibujadas % COLUMNAS;
    const x = MARGEN + col * (cellW + GAP_X);
    const y = MARGEN + fila * (ALTO_ETIQUETA + GAP_Y);
    dibujarEtiqueta(item, x, y);
    dibujadas++;
  });

  return dibujadas;
}
