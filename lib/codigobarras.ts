// Code128 (variantes B y C) - encoder propio, sin dependencias.
// Los patrones oficiales tienen 6 barras/espacios por símbolo (11 módulos)
// excepto el STOP (106) que tiene 13 módulos.

const BARS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011'
];

const START_B = 104;
const START_C = 105;
const CODE_C = 99;
const MODULO = 103;
const STOP = 106;
const QUIET_ZONES = 10;

export const normalizarCodigo = (crudo: unknown): string =>
  String(crudo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

export type CodigoEncodeado = { patron: string; modulos: number; texto: string };

export function encodeCode128(valor: unknown): CodigoEncodeado | null {
  const texto = normalizarCodigo(valor);
  if (!texto) return null;

  const soloDigitos = /^[0-9]+$/.test(texto);
  const valores: number[] = [];

  if (soloDigitos && texto.length % 2 === 0) {
    valores.push(START_C);
    for (let i = 0; i < texto.length; i += 2) valores.push(Number(texto.slice(i, i + 2)));
  } else if (soloDigitos && texto.length > 1) {
    valores.push(START_B);
    valores.push(texto.charCodeAt(0) - 32);
    valores.push(CODE_C);
    for (let i = 1; i < texto.length; i += 2) valores.push(Number(texto.slice(i, i + 2)));
  } else {
    valores.push(START_B);
    for (let i = 0; i < texto.length; i++) valores.push(texto.charCodeAt(i) - 32);
  }

  let suma = valores[0];
  for (let i = 1; i < valores.length; i++) suma += valores[i] * i;
  valores.push(suma % MODULO);
  valores.push(STOP);

  const patron = valores.map(v => {
    const barra = BARS[v];
    if (!barra) throw new Error(`Code128: símbolo inválido ${v}`);
    return barra;
  }).join('');

  return { patron, modulos: patron.length, texto };
}

export const anchoTotalModulos = (patron: string) => patron.length + QUIET_ZONES * 2;

// Devuelve corridas de barras negras: [{ inicio, largo }] en módulos.
export function corridasDeBarras(patron: string): { inicio: number; largo: number }[] {
  const corridas: { inicio: number; largo: number }[] = [];
  let i = 0;
  while (i < patron.length) {
    if (patron[i] === '1') {
      let j = i;
      while (j < patron.length && patron[j] === '1') j++;
      corridas.push({ inicio: i, largo: j - i });
      i = j;
    } else i++;
  }
  return corridas;
}

// Dibuja el código de barras como vectores dentro de un jsPDF.
// x, y, ancho, alto están en las unidades del documento (mm por defecto).
export type DocPdf = {
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, estilo: string) => void;
};

export function drawCode128EnPdf(doc: DocPdf, valor: unknown, x: number, y: number, ancho: number, alto: number): boolean {
  const enc = encodeCode128(valor);
  if (!enc) return false;
  const unidad = ancho / anchoTotalModulos(enc.patron);
  doc.setFillColor(0, 0, 0);
  for (const c of corridasDeBarras(enc.patron)) {
    doc.rect(x + (QUIET_ZONES + c.inicio) * unidad, y, c.largo * unidad, alto, 'F');
  }
  return true;
}

// SVG completo para mostrar en pantalla (modal de producto). Mismo encoder que el PDF.
export function barcodeSvg(valor: unknown, anchoPx: number, altoPx: number, color = '#000000', fondo = '#ffffff'): string | null {
  const enc = encodeCode128(valor);
  if (!enc) return null;
  const unidad = anchoPx / anchoTotalModulos(enc.patron);
  const barras = corridasDeBarras(enc.patron)
    .map(c => `<rect x="${((QUIET_ZONES + c.inicio) * unidad).toFixed(3)}" y="0" width="${(c.largo * unidad).toFixed(3)}" height="${altoPx}" />`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoPx}" height="${altoPx}" viewBox="0 0 ${anchoPx} ${altoPx}" shape-rendering="crispEdges" role="img" aria-label="Código de barras ${enc.texto}"><rect width="${anchoPx}" height="${altoPx}" fill="${fondo}" /><g fill="${color}">${barras}</g></svg>`;
}
