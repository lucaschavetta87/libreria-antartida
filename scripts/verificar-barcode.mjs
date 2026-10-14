// Verificación end-to-end de los códigos de barras y de las etiquetas PDF.
// Genera PDFs y SVG, los rasteriza y los decodifica con zbarimg.
// Uso: node scripts/verificar-barcode.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { jsPDF } from 'jspdf';
import { encodeCode128, drawCode128EnPdf, barcodeSvg, anchoTotalModulos } from '../lib/codigobarras.ts';
import { dibujarEtiquetasEnDoc, promoVisible } from '../lib/etiquetasPdf.ts';

const tmp = fs.mkdtempSync('/tmp/opencode/barras-');
const er = (m) => { console.error('❌ ' + m); process.exit(1); };

for (const bin of ['zbarimg', 'pdftoppm', 'rsvg-convert']) {
  try { execFileSync('which', [bin]); } catch { er(`Falta la herramienta "${bin}" en el sistema.`); }
}

const decodificar = (archivo) => {
  try {
    return execFileSync('zbarimg', ['-q', '--raw', archivo], { encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    return String(e.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  }
};

const casos = [
  'IND-000123',
  'IND-000001',
  '7791234567890',
  '779123456789',
  '123456',
  '12345',
  'ABC-123/45',
  'SAH-2024 (x2)',
  'a1B2c3',
  'IND-009999'
];

// 1) PDF con todos los códigos --------------------------------------------
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
casos.forEach((c, i) => {
  const y = 15 + i * 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(c, 15, y);
  const ok = drawCode128EnPdf(doc, c, 15, y + 2, 150, 16);
  if (!ok) er(`No se pudo dibujar "${c}" en el PDF`);
});
const pdfPath = path.join(tmp, 'barras.pdf');
fs.writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
execFileSync('pdftoppm', ['-r', '300', '-png', '-f', '1', '-l', '1', pdfPath, path.join(tmp, 'pdf')]);
const pngPdf = fs.readdirSync(tmp).find(f => f.startsWith('pdf') && f.endsWith('.png'));
const decodificadosPdf = decodificar(path.join(tmp, pngPdf));

// 2) SVG -> PNG ------------------------------------------------------------
const decodificadosSvg = [];
for (const c of casos) {
  const svg = barcodeSvg(c, 700, 140);
  if (!svg) er(`No se pudo generar SVG para "${c}"`);
  const svgPath = path.join(tmp, `bc_${c.replace(/[^a-zA-Z0-9]/g, '_')}.svg`);
  fs.writeFileSync(svgPath, svg);
  const pngPath = svgPath.replace('.svg', '.png');
  execFileSync('rsvg-convert', ['-w', '700', '-o', pngPath, svgPath]);
  const salida = decodificar(pngPath);
  if (salida.length !== 1) er(`SVG de "${c}" decodificó ${salida.length} veces: ${JSON.stringify(salida)}`);
  decodificadosSvg.push(salida[0]);
}

const faltantesPdf = casos.filter(c => !decodificadosPdf.includes(c));
const faltantesSvg = casos.filter(c => !decodificadosSvg.includes(c));
if (faltantesPdf.length) er(`El PDF no decodificó: ${faltantesPdf.join(', ')}`);
if (faltantesSvg.length) er(`Los SVG no decodificaron: ${faltantesSvg.join(', ')}`);

console.log(`✅ 1) PDF suelto: ${casos.length}/${casos.length} códigos escanean`);
console.log(`✅ 2) SVG del modal: ${casos.length}/${casos.length} códigos escanean`);

// 3) Hoja real de etiquetas (la misma que genera "Imprimir códigos de barra")
const productos = Array.from({ length: 60 }, (_, i) => ({
  nombre: i % 4 === 0
    ? `Producto de prueba número ${i + 1} con un nombre bastante largo para forzar el corte del texto`
    : `Producto de prueba ${i + 1}`,
  codigo: i % 4 === 0 ? `7791234${String(i + 1).padStart(4, '0')}` : `IND-${String(i + 1).padStart(6, '0')}`,
  precio_minorista: 1000 + i,
  precio_mayorista: 800 + i,
  precio_promo: i % 6 === 0 ? '2x3900' : (i % 6 === 2 ? '0' : (i % 6 === 4 ? '-' : null)),
  variedades: i % 7 === 0 ? [{ precio_minorista: 950 + i }] : []
}));

const hoja = new jsPDF({ unit: 'mm', format: 'a4' });
const dibujadas = dibujarEtiquetasEnDoc(hoja, productos);
if (dibujadas !== productos.length) er(`Se dibujaron ${dibujadas} etiquetas de ${productos.length}`);
const hojaPath = path.join(tmp, 'etiquetas.pdf');
fs.writeFileSync(hojaPath, Buffer.from(hoja.output('arraybuffer')));

const prefijo = path.join(tmp, 'hoja');
execFileSync('pdftoppm', ['-r', '300', '-png', hojaPath, prefijo]);
const paginas = fs.readdirSync(tmp).filter(f => f.startsWith('hoja') && f.endsWith('.png')).sort();
const decodificadosHoja = paginas.flatMap(p => decodificar(path.join(tmp, p)));

const esperados = productos.map(p => p.codigo);
const faltantesHoja = esperados.filter(c => !decodificadosHoja.includes(c));
const inesperados = decodificadosHoja.filter(c => !esperados.includes(c));
if (faltantesHoja.length) er(`La hoja de etiquetas no escanea: ${faltantesHoja.join(', ')}`);
if (inesperados.length) er(`Códigos de más en la hoja: ${inesperados.join(', ')}`);
console.log(`✅ 3) Hoja de etiquetas: ${paginas.length} páginas, ${dibujadas} etiquetas y las ${esperados.length} escanean`);

// 4) Texto de la etiqueta (promo y precios) --------------------------------
try {
  execFileSync('which', ['pdftotext']);
  const texto = execFileSync('pdftotext', [hojaPath, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  const conPromo = productos.filter(p => promoVisible(p.precio_promo)).length;
  const promoOk = (texto.match(/PROMO 2X3900/g) || []).length;
  const promoBasura = (texto.match(/PROMO (0|-|\u00a0)\b/g) || []).length;
  const minOk = (texto.match(/Min \$[\d.]+/g) || []).length;
  const mayOk = (texto.match(/May \$[\d.]+/g) || []).length;
  if (promoOk !== conPromo) er(`Se esperaban ${conPromo} promos en el PDF y hay ${promoOk}`);
  if (promoBasura) er(`El PDF imprime ${promoBasura} promos vacías (PROMO 0 / PROMO -)`);
  if (minOk !== dibujadas) er(`Se esperaban ${dibujadas} precios Min y hay ${minOk}`);
  if (mayOk !== dibujadas) er(`Se esperaban ${dibujadas} precios May y hay ${mayOk}`);
  console.log(`✅ 4) Texto: ${promoOk}/${conPromo} promos reales, 0 promos vacías, ${minOk} precios Min y ${mayOk} precios May`);
} catch (e) {
  console.log('⚠️ 4) pdftotext no disponible: se omite la verificación de textos');
}

// 5) Tamaño de la fuente de precios en la etiqueta --------------------------
try {
  execFileSync('which', ['pdftohtml']);
  const xml = execFileSync('pdftohtml', ['-xml', '-stdout', '-f', '1', '-l', '1', hojaPath], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });
  const alturas = (re) => [...xml.matchAll(re)].map(m => Number(m[1]));
  const alturasMin = alturas(/<text[^>]*height="(\d+)"[^>]*><b>Min \$/g);
  const alturasMay = alturas(/<text[^>]*height="(\d+)"[^>]*><b>May \$/g);
  if (!alturasMin.length || !alturasMay.length) er('No se encontraron los textos Min/May en el XML del PDF');
  const minH = Math.min(...alturasMin);
  const mayH = Math.min(...alturasMay);
  if (minH < 17) er(`La fuente de "Min $" quedó chica (alto ${minH}px, se esperaba >= 17)`);
  if (mayH < 13) er(`La fuente de "May $" quedó chica (alto ${mayH}px, se esperaba >= 13)`);
  console.log(`✅ 5) Fuente de precios: "Min $" alto ${minH}px y "May $" alto ${mayH}px (antes: 15 y 10)`);
} catch (e) {
  console.log('⚠️ 5) pdftohtml no disponible: se omite la verificación de tamaños');
}

// 6) Anchos impresos --------------------------------------------------------
console.log('\nAnchos de módulo a 50 mm de ancho (mínimo recomendado 0.25 mm):');
for (const c of casos) {
  const enc = encodeCode128(c);
  const mod = anchoTotalModulos(enc.patron);
  const mm = 50 / mod;
  console.log(`  ${c.padEnd(16)} ${String(enc.patron.length).padStart(4)} módulos  -> ${mm.toFixed(3)} mm/módulo${mm < 0.25 ? '  ⚠️' : ''}`);
  if (mm < 0.25) er(`El código "${c}" quedaría con módulos demasiado chicos a 50mm`);
}

console.log(`\n✅ Verificación completa. Archivos temporales en ${tmp}`);
