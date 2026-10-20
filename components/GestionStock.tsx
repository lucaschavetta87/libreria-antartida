"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

import FormularioProducto from './FormularioProducto';
import ModificadoresMasivos from './ModificadoresMasivos';
import TablaStock from './TablaStock';
import ModalCategorias from './Modalcategorias';
import ModalGenerico from './ModalGenerico';
import ActualizarPrecios from './ActualizarPrecios';
import CodigoBarras from './CodigoBarras';
import MenuBotonCategorias from './MenusPDF';
import MenuCatalogoCompleto, { OpcionesCatalogoCompleto } from './MenuCatalogoCompleto';
import ModalCategoria from './ModalCategoria';
import OjoVisibilidad, { TipoOcultable, ocultaEnWeb } from './ui/OjoVisibilidad';
import {
  PRINCIPALES_POR_DEFECTO, calcularPrincipales, esPrincipal as esCatPrincipal,
  generarIdCategoria, leerPrincipalesLocal, guardarPrincipalesLocal, limpiarPrincipalesLocal
} from '../lib/categorias';
import { normalizarCodigo } from '../lib/codigobarras';
import { dibujarEtiquetasEnDoc } from '../lib/etiquetasPdf';
import { prepararImagenRedimensionada, subirArchivoAStorage } from '../lib/imageUtils';
import { useToast } from './ui/Avisos';

const CATEGORIAS_PRINCIPALES = [
  { id: 'aromanza', label: 'Aromanza' },
  { id: 'sagrada_madre', label: 'Sagrada Madre' },
  { id: 'ganesha', label: 'Aromas Ganesha' },
  { id: 'iluminarte', label: 'Iluminarte' }
];

const IDS_PRINCIPALES = CATEGORIAS_PRINCIPALES.map(c => c.id);

const CATEGORIAS_DEFAULT = [
  ...CATEGORIAS_PRINCIPALES,
  { id: 'bazar_banos', label: 'Bazar Baños' },
  { id: 'carbon_vegetal', label: 'Carbón Vegetal Encendido Rápido' },
  { id: 'cuencos_armonizadores', label: 'Cuencos y Armonizadores' },
  { id: 'fuentes_agua', label: 'Fuentes de Agua y Jardín Zen' },
  { id: 'hornitos_vela', label: 'Hornitos a Vela y Eléctricos' },
  { id: 'humidificadores', label: 'Humidificadores y Dispensadores' },
  { id: 'lamparas_sal', label: 'Lámparas de Sal' },
  { id: 'llamadores_atrapasuenos', label: 'Llamadores y Atrapasueños' },
  { id: 'llaveros', label: 'Llaveros' },
  { id: 'otros_ofertas', label: 'Otros Ofertas' },
  { id: 'piedras_dijes', label: 'Piedras y Dijes' },
  { id: 'portasahumerios_cascadas', label: 'Portasahumerios y Cascadas de Humo' },
  { id: 'productos_defumacion', label: 'Productos de Defumación' },
  { id: 'productos_esotericos', label: 'Productos Esotéricos' },
  { id: 'regaleria_handicraft', label: 'Regalería y Handicraft' },
  { id: 'rosarios_denarios', label: 'Rosarios Denarios y Pulas' },
  { id: 'sahumadores_morteros', label: 'Sahumadores y Morteros' },
  { id: 'sahumerios_nuna', label: 'Sahumerios Nuna Terra' },
  { id: 'sales', label: 'Sales' },
  { id: 'saphirus', label: 'Saphirus' },
  { id: 'talismanes_ojos', label: 'Talismanes y Ojos' },
  { id: 'tetera_tazas', label: 'Tetera Tazas y Vasos' },
  { id: 'tarot_radiestesia', label: 'Tarot y Radiestesia' },
  { id: 'sahumerios_importados', label: 'Sahumerios Importados' },
  { id: 'velas', label: '🕯️ Velas' }
];

const COLUMNAS_PRECIO = [
  { id: 'precio_costo', label: 'Costo' },
  { id: 'precio_iva', label: '+IVA' },
  { id: 'precio_mayorista', label: 'Mayorista' },
  { id: 'precio_minorista', label: 'Minorista' },
];

const SIN_SUB = '__sin__';
const MIME_STOCK = 'application/x-stock-drag';

type Variedad = { id: string; nombre: string; codigo: string; imagen_url: string; precio_costo?: number; precio_iva?: number; precio_mayorista?: number; precio_minorista?: number; precio_promo?: string | null };
type Seleccion = { cat: string; sub: string | null; subsub?: string | null };

const capitalizar = (t: string) => t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
const nuevoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function ModalImportarExcel({ isOpen, onClose, categorias, stock, setStock, darkMode, setSel }: any) {
  const toast = useToast();
  const [archivoNombre, setArchivoNombre] = useState('');
  const [libroTrabajo, setLibroTrabajo] = useState<XLSX.WorkBook | null>(null);
  const [hojas, setHojas] = useState<string[]>([]);
  const [hojaSeleccionada, setHojaSeleccionada] = useState('');
  const [datosCrudos, setDatosCrudos] = useState<any[][]>([]);
  const [filaCabecera, setFilaCabecera] = useState<number>(0);
  const [columnasDetectadas, setColumnasDetectadas] = useState<string[]>([]);
  
  const [listaCategorias, setListaCategorias] = useState<any[]>(categorias || []);
  const [subcategoriasDB, setSubcategoriasDB] = useState<any[]>([]);
  const [subsubsDB, setSubsubsDB] = useState<{ id: string; categoria: string; subcategoria: string; nombre: string }[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('aromanza');
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState('');
  const [subsubSeleccionada, setSubsubSeleccionada] = useState('');

  const [colCodigo, setColCodigo] = useState<string>('');
  const [colNombre, setColNombre] = useState<string>('');
  const [colCosto, setColCosto] = useState<string>('');
  const [colIva, setColIva] = useState<string>('');
  const [colMayorista, setColMayorista] = useState<string>('');
  const [colMinorista, setColMinorista] = useState<string>('');
  const [colPromo, setColPromo] = useState<string>('');

  const [modoImportacion, setModoImportacion] = useState<'normal' | 'variedades'>('normal');
  const [nombreProductoVariedades, setNombreProductoVariedades] = useState<string>('');
  const [preciosVariedades, setPreciosVariedades] = useState<'igual' | 'por_variedad'>('igual');

  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setListaCategorias(categorias);
      cargarSubcategoriasBD();
      cargarSubsubsBD();
    }
  }, [isOpen, categorias]);

  const cargarSubcategoriasBD = async () => {
    const { data } = await supabase.from('subcategorias').select('*');
    if (data) setSubcategoriasDB(data);
  };

  const cargarSubsubsBD = async () => {
    const { data } = await supabase.from('subsubcategorias').select('*');
    if (data) setSubsubsDB(data);
  };

  if (!isOpen) return null;

  const themeBg = darkMode ? '#1e293b' : '#ffffff';
  const themeText = darkMode ? '#f8fafc' : '#0f172a';
  const themeBorder = darkMode ? '#334155' : '#cbd5e1';
  const themeInput = darkMode ? '#0f172a' : '#f8fafc';

  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setArchivoNombre(archivo.name);
    setModoImportacion('normal');
    setNombreProductoVariedades('');
    setPreciosVariedades('igual');
    const lector = new FileReader();
    lector.readAsArrayBuffer(archivo);
    
    lector.onload = (evento) => {
      try {
        const datosBuffer = evento.target?.result as ArrayBuffer;
        const libro = XLSX.read(datosBuffer, { type: 'array' });
        setLibroTrabajo(libro);
        setHojas(libro.SheetNames);
        if (libro.SheetNames.length > 0) {
          seleccionarHoja(libro, libro.SheetNames[0]);
        }
      } catch (err) {
        toast.error("Error al leer el archivo Excel.");
      }
    };
  };

  const seleccionarHoja = (libro: XLSX.WorkBook, nombreHoja: string) => {
    setHojaSeleccionada(nombreHoja);
    const hoja = libro.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json<any>(hoja, { header: 1, defval: '' }) as any[][];
    setDatosCrudos(filas);
    
    let idxCabecera = 0;
    for (let i = 0; i < Math.min(20, filas.length); i++) {
       const f = filas[i];
       if (f.filter(c => String(c).trim().length > 2).length >= 3) {
          idxCabecera = i;
          break;
       }
    }
    establecerFilaCabecera(filas, idxCabecera);
  };

  const establecerFilaCabecera = (filas: any[][], idx: number) => {
    setFilaCabecera(idx);
    const maxCols = filas.length > 0 ? Math.max(1, ...filas.slice(0, 50).map(r => r.length || 0)) : 1;
    const cabeceras = Array.from({ length: maxCols }).map((_, i) => {
      const cell = filas[idx]?.[i];
      return cell ? String(cell).trim() : `Columna ${i + 1}`;
    });
    setColumnasDetectadas(cabeceras);
    
    let cNom = '', cCod = '', cCos = '', cIva = '', cMay = '', cMin = '', cPromo = '';
    cabeceras.forEach((c, i) => {
       const min = c.toLowerCase();
       if ((min.includes('ean') || min.includes('cod') || min.includes('barra')) && cCod === '') cCod = i.toString();
       if ((min.includes('nom') || min.includes('desc') || min.includes('prod') || min.includes('art')) && cNom === '') cNom = i.toString();
       if ((min.includes('cost') || (min.includes('prec') && !min.includes('iva') && !min.includes('may') && !min.includes('minor') && !min.includes('promo'))) && cCos === '') cCos = i.toString();
       if (min.includes('iva') && cIva === '') cIva = i.toString();
       if (min.includes('may') && cMay === '') cMay = i.toString();
       if (min.includes('minor') && cMin === '') cMin = i.toString();
       if ((min.includes('promo') || min.includes('oferta')) && cPromo === '') cPromo = i.toString();
    });
    
    setColNombre(cNom); setColCodigo(cCod); setColCosto(cCos); setColIva(cIva); setColMayorista(cMay);
    setColMinorista(cMin); setColPromo(cPromo);
  };

  const limpiarPrecio = (valor: any): number => {
    if (!valor) return 0;
    if (typeof valor === 'number') return Math.round(valor);
    let texto = String(valor).replace(/[^0-9.,]/g, '');
    if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
    else if (texto.includes(',')) texto = texto.replace(',', '.');
    return Math.round(parseFloat(texto)) || 0;
  };

  const manejarCambioCategoria = async (val: string) => {
    if (val === 'NUEVA') {
      const nombre = window.prompt('Nombre de la nueva categoría principal:');
      if (nombre && nombre.trim()) {
        const id = nombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
        const { data, error } = await supabase.from('categorias').insert([{ id, label: nombre.trim() }]).select().single();
        if (!error && data) {
          setListaCategorias(prev => [...prev, data]);
          setCategoriaSeleccionada(data.id);
        } else {
          toast.error("Error al crear categoría en la base de datos.");
        }
      }
    } else {
      setCategoriaSeleccionada(val);
      setSubcategoriaSeleccionada('');
      setSubsubSeleccionada('');
    }
  };

  const manejarCambioSubcategoria = async (val: string) => {
    if (val === 'NUEVA') {
      if (!categoriaSeleccionada) return toast.avisar("Seleccioná una categoría principal primero.", 'alerta');
      const nombre = window.prompt('Nombre de la nueva subcategoría:');
      if (nombre && nombre.trim()) {
        const { data, error } = await supabase.from('subcategorias').insert([{ categoria: categoriaSeleccionada, nombre: nombre.trim() }]).select().single();
        if (!error && data) {
          setSubcategoriasDB(prev => [...prev, data]);
          setSubcategoriaSeleccionada(data.nombre.toLowerCase());
          setSubsubSeleccionada('');
        } else {
          toast.error("Error al crear subcategoría.");
        }
      }
    } else {
      setSubcategoriaSeleccionada(val);
      setSubsubSeleccionada('');
    }
  };

  const manejarCambioSubsub = async (val: string) => {
    if (val === 'NUEVA') {
      if (!categoriaSeleccionada) return toast.avisar("Seleccioná una categoría principal primero.", 'alerta');
      if (!subcategoriaSeleccionada) return toast.avisar("Seleccioná una subcategoría primero.", 'alerta');
      const nombre = window.prompt('Nombre de la nueva subcarpeta:');
      if (nombre && nombre.trim()) {
        const { data, error } = await supabase.from('subsubcategorias').insert([{ categoria: categoriaSeleccionada, subcategoria: subcategoriaSeleccionada, nombre: nombre.trim() }]).select().single();
        if (!error && data) {
          setSubsubsDB(prev => [...prev, data]);
          setSubsubSeleccionada(String(data.nombre).trim().toLowerCase());
        } else {
          toast.error("Error al crear subcarpeta.");
        }
      }
    } else {
      setSubsubSeleccionada(val);
    }
  };

  const procesarImportacion = async () => {
    if (colNombre === '') {
      toast.avisar("Por favor, indicá al menos la columna de 'Nombre / Artículo'.", 'alerta');
      return;
    }
    setImportando(true);
    try {
      const mapaExistentes = new Map<string, any>();
      const mapaCodigos = new Map<string, any>();
      (stock || []).forEach((item: any) => {
         if (item.nombre) mapaExistentes.set(item.nombre.trim().toLowerCase(), item);
         if (item.codigo) mapaCodigos.set(item.codigo.trim().toLowerCase(), item);
      });

      const mapaActualizar = new Map<string, any>();
      const mapaNuevos = new Map<string, any>();

      for (let i = filaCabecera + 1; i < datosCrudos.length; i++) {
         const row = datosCrudos[i];
         if (!row || row.length === 0) continue;

         let nombreProducto = row[Number(colNombre)] ? String(row[Number(colNombre)]).trim() : '';
         if (!nombreProducto || nombreProducto.length < 2 || nombreProducto.toLowerCase().includes('nombre') || nombreProducto.toLowerCase().includes('precio')) continue;

         let codigoVal = (colCodigo !== '' && row[Number(colCodigo)]) ? String(row[Number(colCodigo)]).trim() : '';
         let codigoProducto = codigoVal || null; 
         
         const datosPrecio: any = {};
         if (colCosto !== '' && row[Number(colCosto)] !== undefined) datosPrecio.precio_costo = limpiarPrecio(row[Number(colCosto)]);
         if (colIva !== '' && row[Number(colIva)] !== undefined) datosPrecio.precio_iva = limpiarPrecio(row[Number(colIva)]);
         if (colMayorista !== '' && row[Number(colMayorista)] !== undefined) datosPrecio.precio_mayorista = limpiarPrecio(row[Number(colMayorista)]);
         if (colMinorista !== '' && row[Number(colMinorista)] !== undefined) datosPrecio.precio_minorista = limpiarPrecio(row[Number(colMinorista)]);
         if (colPromo !== '' && row[Number(colPromo)] !== undefined) {
            const promoVal = String(row[Number(colPromo)]).trim().toLowerCase();
            datosPrecio.precio_promo = promoVal || null;
         }

         const nombreKey = nombreProducto.toLowerCase();
         let productoExistente = mapaExistentes.get(nombreKey);
         if (!productoExistente && codigoProducto) {
             productoExistente = mapaCodigos.get(codigoProducto.toLowerCase());
         }

         if (productoExistente) {
             if (!mapaActualizar.has(productoExistente.id)) {
                 mapaActualizar.set(productoExistente.id, {
                     id: productoExistente.id,
                     codigo: codigoProducto || productoExistente.codigo,
                     ...datosPrecio,
                     categoria: categoriaSeleccionada || 'aromanza',
                     subcategoria: subcategoriaSeleccionada || null,
                     subsubcategoria: subsubSeleccionada || null,
                 });
             }
         } else {
             if (!mapaNuevos.has(nombreKey)) {
                 mapaNuevos.set(nombreKey, {
                     codigo: codigoProducto,
                     nombre: nombreProducto,
                     ...datosPrecio,
                     categoria: categoriaSeleccionada || 'aromanza',
                     subcategoria: subcategoriaSeleccionada || null,
                     subsubcategoria: subsubSeleccionada || null,
                     imagen_url: null,
                     variedades: [],
                     sin_stock: false,
                 });
             }
         }
      }

      const registrosParaActualizar = Array.from(mapaActualizar.values()).map(p => {
         const payload: any = {
             id: p.id,
             categoria: categoriaSeleccionada || 'aromanza',
             subcategoria: subcategoriaSeleccionada || null,
             subsubcategoria: subsubSeleccionada || null,
             ultima_actualizacion: new Date().toLocaleString()
         };
         if (p.codigo !== undefined) payload.codigo = p.codigo;
         if (p.precio_costo !== undefined) payload.precio_costo = p.precio_costo;
         if (p.precio_iva !== undefined) payload.precio_iva = p.precio_iva;
         if (p.precio_mayorista !== undefined) payload.precio_mayorista = p.precio_mayorista;
         if (p.precio_minorista !== undefined) payload.precio_minorista = p.precio_minorista;
         if (p.precio_promo !== undefined) payload.precio_promo = p.precio_promo;
         return payload;
      });

      const registrosParaCrear = Array.from(mapaNuevos.values());

      let totalModificados = 0;
      let totalCreados = 0;
      let itemsAgregadosAlEstado: any[] = [];

      if (registrosParaActualizar.length > 0) {
         for (const reg of registrosParaActualizar) {
            let { error: errUp } = await supabase.from('stock').update(reg).eq('id', reg.id);
            if (errUp && /column|schema cache/i.test(String(errUp.message || ''))) {
               const sinNivel3 = { ...reg };
               delete sinNivel3.subsubcategoria;
               ({ error: errUp } = await supabase.from('stock').update(sinNivel3).eq('id', reg.id));
            }
            if (errUp) throw new Error(`Error al actualizar: ${errUp.message}`);
            totalModificados++;
         }
      }
      
      if (registrosParaCrear.length > 0) {
         for (let i = 0; i < registrosParaCrear.length; i += 500) {
            const chunk = registrosParaCrear.slice(i, i + 500);
            let { data: dataIns, error: errIns } = await supabase.from('stock').upsert(chunk, { onConflict: 'nombre' }).select();
            if (errIns && /column|schema cache/i.test(String(errIns.message || ''))) {
               const sinNivel3 = chunk.map(r => { const copia = { ...r }; delete copia.subsubcategoria; return copia; });
               ({ data: dataIns, error: errIns } = await supabase.from('stock').upsert(sinNivel3, { onConflict: 'nombre' }).select());
            }
            if (errIns) throw new Error(`Error al insertar productos nuevos: ${errIns.message}`);
            if (dataIns) {
               totalCreados += dataIns.length;
               itemsAgregadosAlEstado.push(...dataIns);
            }
         }
      }

      setStock((prevStock: any[]) => {
         const mapa = new Map(prevStock.map(item => [item.id, item]));
         registrosParaActualizar.forEach(reg => {
            if (mapa.has(reg.id)) {
               mapa.set(reg.id, { ...mapa.get(reg.id), ...reg });
            }
         });
         itemsAgregadosAlEstado.forEach(nuevo => {
            mapa.set(nuevo.id, nuevo);
         });
         return Array.from(mapa.values());
      });

      setSel({ cat: categoriaSeleccionada, sub: subcategoriaSeleccionada ? subcategoriaSeleccionada.toLowerCase() : null, subsub: subsubSeleccionada || null });
      toast.exito(`Importación finalizada. Productos actualizados: ${totalModificados} · Nuevos creados: ${totalCreados}`, 8000);
      onClose();
    } catch (err: any) { 
      toast.error(`Error de base de datos: ${err.message}`);
    } finally { 
      setImportando(false); 
    }
  };

  const procesarImportacionVariedades = async () => {
    const nombreProducto = nombreProductoVariedades.trim();
    if (!nombreProducto) {
      toast.avisar("Escribí el nombre del producto principal.", 'alerta');
      return;
    }
    if (colNombre === '') {
      toast.avisar("Indicá cuál es la columna que tiene el nombre / artículos.", 'alerta');
      return;
    }
    setImportando(true);
    try {
      const datosPrecio: any = {};
      let precioTomado = false;
      const precioPorVariedad = preciosVariedades === 'por_variedad';
      const variedadesNuevas: Variedad[] = [];
      const nombresVistos = new Set<string>();

      for (let i = filaCabecera + 1; i < datosCrudos.length; i++) {
        const row = datosCrudos[i];
        if (!row || row.length === 0) continue;

        const colIdxNombre = Number(colNombre);
        const nombreVariedadVal = row[colIdxNombre] ? String(row[colIdxNombre]).trim() : '';
        if (!nombreVariedadVal) continue;
        if (nombreVariedadVal.toLowerCase().includes('nombre') || nombreVariedadVal.toLowerCase().includes('artículo')) continue;

        if (!precioTomado) {
          if (colCosto !== '') datosPrecio.precio_costo = limpiarPrecio(row[Number(colCosto)]);
          if (colIva !== '') datosPrecio.precio_iva = limpiarPrecio(row[Number(colIva)]);
          if (colMayorista !== '') datosPrecio.precio_mayorista = limpiarPrecio(row[Number(colMayorista)]);
          if (colMinorista !== '') datosPrecio.precio_minorista = limpiarPrecio(row[Number(colMinorista)]);
          if (colPromo !== '') {
            const promoVal = row[Number(colPromo)] ? String(row[Number(colPromo)]).trim().toLowerCase() : '';
            datosPrecio.precio_promo = promoVal || null;
          }
          precioTomado = true;
        }

        const codigoVariedad = (colCodigo !== '' && row[Number(colCodigo)]) ? String(row[Number(colCodigo)]).trim() : '';
        const keyVar = nombreVariedadVal.toLowerCase();
        if (nombresVistos.has(keyVar)) continue;
        nombresVistos.add(keyVar);

        const variedadBase: Variedad = { id: nuevoId(), nombre: nombreVariedadVal, codigo: codigoVariedad, imagen_url: '' };
        if (precioPorVariedad) {
          const preciosVar: any = {};
          if (colCosto !== '') preciosVar.precio_costo = limpiarPrecio(row[Number(colCosto)]);
          if (colIva !== '') preciosVar.precio_iva = limpiarPrecio(row[Number(colIva)]);
          if (colMayorista !== '') preciosVar.precio_mayorista = limpiarPrecio(row[Number(colMayorista)]);
          if (colMinorista !== '') preciosVar.precio_minorista = limpiarPrecio(row[Number(colMinorista)]);
          if (colPromo !== '') {
            const promoVal = row[Number(colPromo)] ? String(row[Number(colPromo)]).trim().toLowerCase() : '';
            preciosVar.precio_promo = promoVal || null;
          }
          variedadesNuevas.push({ ...variedadBase, ...preciosVar });
        } else {
          variedadesNuevas.push(variedadBase);
        }
      }

      if (variedadesNuevas.length === 0) {
        toast.error("No se encontró ninguna variedad para importar.");
        setImportando(false);
        return;
      }

      const { data: existenteDB } = await supabase
        .from('stock')
        .select('*')
        .ilike('nombre', nombreProducto)
        .maybeSingle();

      let variedadesFinal = variedadesNuevas;
      if (existenteDB) {
        const variedadesActuales: Variedad[] = Array.isArray(existenteDB.variedades) ? existenteDB.variedades : [];
        const actualizadas: Variedad[] = precioPorVariedad
          ? variedadesActuales.map((v: Variedad) => {
              const nueva = variedadesNuevas.find(nv => nv.nombre.trim().toLowerCase() === v.nombre.trim().toLowerCase());
              if (!nueva) return v;
              return {
                ...v,
                ...(nueva.precio_costo !== undefined ? { precio_costo: nueva.precio_costo } : {}),
                ...(nueva.precio_iva !== undefined ? { precio_iva: nueva.precio_iva } : {}),
                ...(nueva.precio_mayorista !== undefined ? { precio_mayorista: nueva.precio_mayorista } : {}),
                ...(nueva.precio_minorista !== undefined ? { precio_minorista: nueva.precio_minorista } : {}),
                ...(nueva.precio_promo !== undefined ? { precio_promo: nueva.precio_promo } : {}),
              };
            })
          : variedadesActuales;
        const nombresActuales = new Set(variedadesActuales.map((v: Variedad) => v.nombre.trim().toLowerCase()));
        const aAgregar = variedadesNuevas.filter(v => !nombresActuales.has(v.nombre.trim().toLowerCase()));
        variedadesFinal = [...actualizadas, ...aAgregar];
      }

      const productoPayload = {
        ...(existenteDB?.id ? { id: existenteDB.id } : {}),
        codigo: existenteDB?.codigo || null,
        nombre: nombreProducto,
        precio_costo: datosPrecio.precio_costo !== undefined ? datosPrecio.precio_costo : (existenteDB?.precio_costo || 0),
        precio_iva: datosPrecio.precio_iva !== undefined ? datosPrecio.precio_iva : (existenteDB?.precio_iva || 0),
        precio_mayorista: datosPrecio.precio_mayorista !== undefined ? datosPrecio.precio_mayorista : (existenteDB?.precio_mayorista || 0),
        precio_minorista: datosPrecio.precio_minorista !== undefined ? datosPrecio.precio_minorista : (existenteDB?.precio_minorista || 0),
        precio_promo: datosPrecio.precio_promo !== undefined ? datosPrecio.precio_promo : (existenteDB?.precio_promo || null),
        categoria: categoriaSeleccionada || 'aromanza',
        subcategoria: subcategoriaSeleccionada || null,
        subsubcategoria: subsubSeleccionada || null,
        imagen_url: existenteDB?.imagen_url || null,
        variedades: variedadesFinal,
        sin_stock: existenteDB?.sin_stock || false,
        ultima_actualizacion: new Date().toLocaleString()
      };

      let { data: productoGuardado, error: errUpsert } = await supabase
        .from('stock')
        .upsert(productoPayload, { onConflict: 'nombre' })
        .select()
        .single();

      if (errUpsert && /column|schema cache/i.test(String(errUpsert.message || ''))) {
        const sinNivel3 = { ...productoPayload };
        delete (sinNivel3 as { subsubcategoria?: unknown }).subsubcategoria;
        ({ data: productoGuardado, error: errUpsert } = await supabase
          .from('stock')
          .upsert(sinNivel3, { onConflict: 'nombre' })
          .select()
          .single());
      }

      if (errUpsert) throw new Error(errUpsert.message);

      if (productoGuardado) {
        setStock((prevStock: any[]) => {
          const existe = prevStock.some(p => p.id === productoGuardado.id);
          if (existe) {
            return prevStock.map(p => p.id === productoGuardado.id ? productoGuardado : p);
          } else {
            return [productoGuardado, ...prevStock];
          }
        });
      }

      setSel({ cat: categoriaSeleccionada, sub: subcategoriaSeleccionada ? subcategoriaSeleccionada.toLowerCase() : null, subsub: subsubSeleccionada || null });
      toast.exito(`Listo. Producto principal: "${nombreProducto}" · Variedades agrupadas: ${variedadesFinal.length}`, 8000);
      onClose();
    } catch (err: any) {
      toast.error(`Error de base de datos: ${err.message}`);
    } finally {
      setImportando(false);
    }
  };

  const subcategoriasFiltradas = subcategoriasDB.filter(s => String(s.categoria).toLowerCase() === categoriaSeleccionada);
  const subsubsFiltradas = subcategoriaSeleccionada
    ? subsubsDB.filter(s => String(s.categoria).trim().toLowerCase() === String(categoriaSeleccionada).trim().toLowerCase() && String(s.subcategoria).trim().toLowerCase() === String(subcategoriaSeleccionada).trim().toLowerCase())
    : [];
  const maxCols = datosCrudos.length > 0 ? Math.max(1, ...datosCrudos.slice(0, 50).map(r => r.length || 0)) : 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', padding: '20px' }}>
      <div style={{ backgroundColor: themeBg, color: themeText, borderRadius: '24px', width: '100%', maxWidth: '1000px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', border: `1px solid ${themeBorder}` }}>
        <div style={{ padding: '20px 30px', borderBottom: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>📥 Importador Inteligente de Excel</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeText, fontSize: '1.2rem' }}>✕</button>
        </div>
        <div style={{ padding: '25px 30px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          <div style={{ border: `2px dashed ${themeBorder}`, padding: '16px', borderRadius: '14px', textAlign: 'center', background: darkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={manejarSeleccionArchivo} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 20px', borderRadius: '10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              {archivoNombre ? `📁 Cambiar archivo: ${archivoNombre}` : '📂 Seleccionar Archivo Excel'}
            </button>
          </div>

          {hojas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '6px', color: '#3b82f6' }}>1. Pestaña del Excel:</label>
                <select value={hojaSeleccionada} onChange={e => seleccionarHoja(libroTrabajo!, e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                  {hojas.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '6px', color: '#3b82f6' }}>2. Categoría / Subcategoría / Sub-subcategoría destino:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={categoriaSeleccionada} onChange={e => manejarCambioCategoria(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0, padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                    {listaCategorias.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    <option value="NUEVA">➕ Crear categoría...</option>
                  </select>
                  <select value={subcategoriaSeleccionada} onChange={e => manejarCambioSubcategoria(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0, padding: '10px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                    <option value="">(Sin subcategoría)</option>
                    {subcategoriasFiltradas.map(s => <option key={s.id} value={s.nombre.toLowerCase()}>{s.nombre}</option>)}
                    <option value="NUEVA">➕ Crear subcategoría...</option>
                  </select>
                  <select
                    value={subcategoriaSeleccionada ? subsubSeleccionada : ''}
                    disabled={!subcategoriaSeleccionada}
                    onChange={e => manejarCambioSubsub(e.target.value)}
                    style={{ flex: '1 1 220px', minWidth: 0, padding: '10px', borderRadius: '8px', border: `1px solid ${subcategoriaSeleccionada ? themeBorder : themeBorder}`, background: subcategoriaSeleccionada ? themeInput : (darkMode ? '#0f172a' : '#e2e8f0'), color: subcategoriaSeleccionada ? themeText : themeBorder, cursor: subcategoriaSeleccionada ? 'pointer' : 'not-allowed', opacity: subcategoriaSeleccionada ? 1 : 0.8 }}
                  >
                    <option value="">{subcategoriaSeleccionada ? '(Sin sub-subcategoría)' : 'Elegí una subcategoría'}</option>
                    {subsubsFiltradas.map(s => <option key={s.id} value={String(s.nombre).trim().toLowerCase()}>{s.nombre}</option>)}
                    <option value="NUEVA">➕ Crear subcarpeta...</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {columnasDetectadas.length > 0 && (
            <>
              <div>
                <label style={{ fontSize: '0.9rem', fontWeight: 800, display: 'block', marginBottom: '4px', color: '#3b82f6' }}>3. Hacé clic en la fila que contiene los TÍTULOS de la tabla:</label>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '200px', border: `1px solid ${themeBorder}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <tbody>
                      {datosCrudos.slice(0, 40).map((row, idx) => {
                        const esCabecera = idx === filaCabecera;
                        return (
                          <tr key={idx} onClick={() => establecerFilaCabecera(datosCrudos, idx)} style={{ backgroundColor: esCabecera ? '#3b82f6' : (darkMode ? '#1e293b' : '#fff'), color: esCabecera ? '#fff' : themeText, cursor: 'pointer', borderBottom: `1px solid ${themeBorder}` }}>
                            <td style={{ padding: '6px 10px', fontWeight: 'bold', borderRight: `1px solid ${themeBorder}` }}>{esCabecera ? '✔️ TÍTULOS' : idx + 1}</td>
                            {Array.from({ length: maxCols }).map((_, cIdx) => (
                              <td key={cIdx} style={{ padding: '6px 10px', borderRight: `1px solid ${themeBorder}` }}>{row[cIdx] !== undefined ? String(row[cIdx]) : ''}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${themeBorder}`, paddingTop: '15px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: '10px', color: '#3b82f6' }}>4. Mapeo de columnas:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre / Artículo *:</label>
                    <select value={colNombre} onChange={e => setColNombre(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Seleccionar...</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Código / EAN:</label>
                    <select value={colCodigo} onChange={e => setColCodigo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Precio Costo:</label>
                    <select value={colCosto} onChange={e => setColCosto(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Precio +IVA:</label>
                    <select value={colIva} onChange={e => setColIva(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Precio Mayorista:</label>
                    <select value={colMayorista} onChange={e => setColMayorista(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Precio Minorista:</label>
                    <select value={colMinorista} onChange={e => setColMinorista(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Precio Promo:</label>
                    <select value={colPromo} onChange={e => setColPromo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText }}>
                      <option value="">Ninguno</option>
                      {columnasDetectadas.map((col, idx) => <option key={idx} value={idx}>{col}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${themeBorder}`, paddingTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: modoImportacion === 'variedades' ? '14px' : 0 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#3b82f6', maxWidth: '560px' }}>5. ¿Agrupar todas las filas como variedades de un solo producto?</label>
                  <button type="button" onClick={() => setModoImportacion(m => m === 'variedades' ? 'normal' : 'variedades')} style={{ padding: '9px 16px', borderRadius: '999px', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', backgroundColor: modoImportacion === 'variedades' ? '#8b5cf6' : (darkMode ? '#334155' : '#e2e8f0'), color: modoImportacion === 'variedades' ? '#fff' : themeText, whiteSpace: 'nowrap' }}>
                    {modoImportacion === 'variedades' ? '🧬 Modo Variedades: ACTIVADO' : '🧬 Subir como un producto con variedades'}
                  </button>
                </div>

                {modoImportacion === 'variedades' && (
                  <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)', border: '1px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: themeText, lineHeight: 1.5 }}>
                      Todas las filas de la columna <strong>Nombre / Artículo</strong> se guardarán como variedades de un solo producto principal.
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#8b5cf6', marginBottom: '8px' }}>¿Todas las variedades tienen el mismo precio?</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', color: themeText }}>
                          <input type="radio" name="precios-variedades" checked={preciosVariedades === 'igual'} onChange={() => setPreciosVariedades('igual')} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                          Sí, todas el mismo precio (se toma el de la primera fila)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', color: themeText }}>
                          <input type="radio" name="precios-variedades" checked={preciosVariedades === 'por_variedad'} onChange={() => setPreciosVariedades('por_variedad')} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                          No, cada variedad tiene su precio (se toma el precio exacto de cada fila)
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Nombre del producto principal *:</label>
                        <input type="text" value={nombreProductoVariedades} onChange={e => setNombreProductoVariedades(e.target.value)} placeholder='Ej: Spray ganesha 250ml' style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${themeBorder}`, background: themeInput, color: themeText, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
        <div style={{ padding: '18px 30px', borderTop: `1px solid ${themeBorder}`, display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${themeBorder}`, background: 'transparent', color: themeText, fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
          {columnasDetectadas.length > 0 && (
            <button onClick={modoImportacion === 'variedades' ? procesarImportacionVariedades : procesarImportacion} disabled={importando} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: modoImportacion === 'variedades' ? '#8b5cf6' : '#059669', color: '#fff', fontWeight: 'bold', cursor: importando ? 'not-allowed' : 'pointer' }}>
              {importando ? 'Procesando...' : (modoImportacion === 'variedades' ? '🧬 Confirmar e Importar con Variedades' : 'Confirmar e Importar Excel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalDetalle({ item, darkMode, onClose, onEdit, onDelete, obtenerLabelCategoria, onAgregarAlCarrito, onCodigoChange }: any) {
  const toast = useToast();
  const [variedadSeleccionada, setVariedadSeleccionada] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [editandoCodigo, setEditandoCodigo] = useState(false);
  const [codigoTemp, setCodigoTemp] = useState('');
  const [guardandoCodigo, setGuardandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setVariedadSeleccionada(null);
    setCantidad(1);
    setEditandoCodigo(false);
    setCodigoTemp('');
    setErrorCodigo('');
  }, [item.id]);

  const iniciarEdicionCodigo = () => {
    setCodigoTemp(item.codigo ? String(item.codigo) : '');
    setErrorCodigo('');
    setEditandoCodigo(true);
  };

  const guardarCodigoEditado = async () => {
    if (!onCodigoChange || guardandoCodigo) return;
    setGuardandoCodigo(true);
    const res = await onCodigoChange(item, codigoTemp);
    setGuardandoCodigo(false);
    if (!res?.ok) setErrorCodigo(res?.error || 'No se pudo guardar el código.');
    else { setEditandoCodigo(false); setErrorCodigo(''); }
  };

  const generarCodigoAuto = async () => {
    if (!onCodigoChange || guardandoCodigo) return;
    setGuardandoCodigo(true);
    const res = await onCodigoChange(item, null);
    setGuardandoCodigo(false);
    if (!res?.ok) setErrorCodigo(res?.error || 'No se pudo generar el código.');
    else { setEditandoCodigo(false); setErrorCodigo(''); }
  };

  const theme = {
    card: darkMode ? '#1e293b' : '#ffffff',
    bg: darkMode ? '#0f172a' : '#f8fafc',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const variedades: Variedad[] = Array.isArray(item.variedades) ? item.variedades : [];
  const variedadActiva = variedades.find(v => v.id === variedadSeleccionada) || null;
  const precioVariedad = (campo: 'precio_costo' | 'precio_iva' | 'precio_mayorista' | 'precio_minorista') => variedadActiva?.[campo] ?? item[campo];
  const precios = [
    { label: 'Costo', value: precioVariedad('precio_costo'), color: theme.subtext },
    { label: '+IVA', value: precioVariedad('precio_iva'), color: theme.subtext },
    { label: 'Mayorista', value: precioVariedad('precio_mayorista'), color: '#8b5cf6' },
    { label: 'Minorista', value: precioVariedad('precio_minorista'), color: '#10b981' },
  ];
  const precioPromo = variedadActiva?.precio_promo ?? item.precio_promo;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: theme.card, borderRadius: '24px', width: '100%', maxWidth: '520px', border: `1px solid ${theme.border}`, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: '100%', height: '240px', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          {item.sin_stock && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.4)', zIndex: 1 }} />}
          {item.sin_stock && <span style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 2, backgroundColor: '#374151', color: 'white', fontWeight: 800, padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>🚫 AGOTADO</span>}
          {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center', color: theme.subtext }}><div style={{ fontSize: '4rem', marginBottom: '8px' }}>📦</div><div style={{ fontSize: '0.85rem' }}>Sin imagen</div></div>}
          <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', backgroundColor: darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', padding: '4px 10px', borderRadius: '999px' }}>
              {obtenerLabelCategoria(item.categoria)} {item.subcategoria ? `› ${capitalizar(item.subcategoria)}` : ''}
            </span>
          </div>
          <h2 style={{ margin: '4px 0 10px 0', color: theme.text, fontSize: '1.3rem', fontWeight: '800', lineHeight: 1.3 }}>{item.nombre}</h2>
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.72rem', color: theme.subtext, fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Código de barras
            </div>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: `1px solid ${theme.border}`, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {item.codigo ? (
                <CodigoBarras codigo={item.codigo} width={300} height={68} />
              ) : (
                <div style={{ padding: '14px', color: '#64748b', fontSize: '0.84rem', fontWeight: 700, border: '1px dashed #cbd5e1', borderRadius: '10px', textAlign: 'center', width: '100%' }}>
                  🚫 Este producto aún no tiene código de barras
                </div>
              )}
              <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#0f172a' }}>
                {item.codigo || '—'}
              </div>

              {!editandoCodigo ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={iniciarEdicionCodigo} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                    ✏️ {item.codigo ? 'Cambiar código' : 'Cargar código'}
                  </button>
                  {!item.codigo && (
                    <button onClick={generarCodigoAuto} disabled={guardandoCodigo} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', opacity: guardandoCodigo ? 0.6 : 1 }}>
                      {guardandoCodigo ? '⏳ Generando...' : '🔄 Generar código automático'}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <input
                    autoFocus
                    value={codigoTemp}
                    onChange={e => setCodigoTemp(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') guardarCodigoEditado(); if (e.key === 'Escape') { setEditandoCodigo(false); setErrorCodigo(''); } }}
                    placeholder="Ej: 7791234567890"
                    style={{ flex: '1 1 180px', minWidth: 0, padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.95rem', textAlign: 'center', color: '#0f172a', background: '#f8fafc', outline: 'none', letterSpacing: '1px' }}
                  />
                  <button onClick={guardarCodigoEditado} disabled={guardandoCodigo} style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', opacity: guardandoCodigo ? 0.6 : 1 }}>
                    {guardandoCodigo ? '⏳' : '✅ Guardar'}
                  </button>
                  <button onClick={() => { setEditandoCodigo(false); setErrorCodigo(''); }} style={{ padding: '9px 14px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.subtext, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    ✕
                  </button>
                </div>
              )}
              {errorCodigo && <div style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center' }}>{errorCodigo}</div>}
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
                Code 128 · compatible con lector de códigos de barras
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '6px', fontSize: '0.72rem', color: theme.subtext, fontWeight: 700 }}>
            {variedadActiva ? `Precios de ${variedadActiva.nombre}` : 'Precios del producto'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {precios.map(p => (
              <div key={p.label} style={{ padding: '12px 14px', borderRadius: '14px', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: '0.68rem', color: theme.subtext, fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{p.label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: p.color }}>${Number(p.value || 0).toLocaleString('es-AR')}</div>
              </div>
            ))}
            {precioPromo && (
              <div style={{ padding: '12px 14px', borderRadius: '14px', backgroundColor: darkMode ? 'rgba(244,63,94,0.1)' : '#fff1f2', border: `1px solid #fda4af`, gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.68rem', color: '#f43f5e', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Promoción</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f43f5e' }}>{String(precioPromo)}</div>
              </div>
            )}
          </div>
          {variedades.length > 0 && (
            <div style={{ marginBottom: '18px', padding: '14px', borderRadius: '14px', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.text, marginBottom: '10px' }}>🌿 Seleccioná la variedad deseada:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                {variedades.map(v => {
                  const seleccionado = variedadSeleccionada === v.id;
                  const fotoVariedad = v.imagen_url || item.imagen_url;
                  const codigoVariedad = v.codigo || item.codigo;
                  return (
                    <div 
                      key={v.id} 
                      onClick={() => setVariedadSeleccionada(v.id)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '10px', 
                        backgroundColor: seleccionado ? (darkMode ? 'rgba(59,130,246,0.2)' : '#eff6ff') : theme.card, 
                        border: `2px solid ${seleccionado ? '#3b82f6' : theme.border}`, cursor: 'pointer', transition: 'all 0.2s' 
                      }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: darkMode ? '#334155' : '#e2e8f0' }}>
                        {fotoVariedad ? <img src={fotoVariedad} alt={v.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🌿</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</div>
                        {codigoVariedad && <div style={{ fontSize: '0.65rem', color: theme.subtext, fontFamily: 'monospace' }}>{codigoVariedad}</div>}
                        {v.precio_minorista !== undefined && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>${Number(v.precio_minorista).toLocaleString()}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 14px', borderRadius: '14px', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Cantidad:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, fontWeight: 'bold', cursor: 'pointer' }}>-</button>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: theme.text, minWidth: '24px', textAlign: 'center' }}>{cantidad}</span>
              <button onClick={() => setCantidad(cantidad + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            {onAgregarAlCarrito && !item.sin_stock && (
              <button onClick={() => { if (variedades.length > 0 && !variedadSeleccionada) { toast.avisar("Por favor, seleccioná una variedad antes de agregar.", 'alerta'); return; } const variedadObj = variedades.find(v => v.id === variedadSeleccionada); onAgregarAlCarrito(item, cantidad, variedadObj); onClose(); }} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '1rem' }}>🛒 Agregar al Carrito</button>
            )}
            {item.sin_stock && (
              <div style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#4b5563', color: 'white', fontWeight: '800', textAlign: 'center', fontSize: '1rem' }}>PRODUCTO AGOTADO</div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { onEdit(item); onClose(); }} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '700', cursor: 'pointer' }}>✏️ Editar</button>
              <button onClick={() => { onDelete(item.id); onClose(); }} style={{ padding: '13px 18px', borderRadius: '12px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: '700', cursor: 'pointer' }}>🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariedadesEditor({ variedades, onChange, darkMode, subirImagen }: any) {
  const toast = useToast();
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [textoComas, setTextoComas] = useState('');

  const t = {
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    input: darkMode ? '#1e293b' : '#ffffff',
    border: darkMode ? '#334155' : '#cbd5e1',
    row: darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
  };

  const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, backgroundColor: t.input, color: t.text, fontSize: '14px', outline: 'none', minWidth: 0 };
  const actualizar = (id: string, cambios: Partial<Variedad>) => onChange(variedades.map((v: Variedad) => v.id === id ? { ...v, ...cambios } : v));
  const agregar = () => onChange([...variedades, { id: nuevoId(), nombre: '', codigo: '', imagen_url: '' }]);
  const quitar = (id: string) => onChange(variedades.filter((v: Variedad) => v.id !== id));

  const agregarPorComas = () => {
    if (!textoComas.trim()) return;
    const nombres = textoComas.split(',').map(n => n.trim()).filter(n => n.length > 0);
    if (nombres.length === 0) return;
    const nuevasVariedades = nombres.map(nombre => ({ id: nuevoId(), nombre, codigo: '', imagen_url: '' }));
    onChange([...variedades, ...nuevasVariedades]);
    setTextoComas('');
  };

  const alElegirFoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoId(id);
    const url = await subirImagen(archivo);
    setSubiendoId(null);
    if (url) actualizar(id, { imagen_url: url });
    else toast.error('No se pudo subir la foto de la variedad.');
    e.target.value = '';
  };

  const campoPrecio: React.CSSProperties = { padding: '7px 8px', borderRadius: '8px', border: `1px solid ${t.border}`, backgroundColor: t.input, color: t.text, fontSize: '12px', outline: 'none', minWidth: 0 };
  const setNumero = (id: string, campo: 'precio_costo' | 'precio_iva' | 'precio_mayorista' | 'precio_minorista', val: string) => {
    const valor = Number(val);
    actualizar(id, { [campo]: val === '' || !Number.isFinite(valor) ? undefined : valor } as Partial<Variedad>);
  };
  const setPromo = (id: string, val: string) => actualizar(id, { precio_promo: val.trim() ? val.trim().toLowerCase() : null });

  const precio = (v: Variedad, campo: 'precio_costo' | 'precio_iva' | 'precio_mayorista' | 'precio_minorista') => v[campo] ?? '';

  return (
    <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: `1px solid ${t.border}` }}>
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: t.text, marginBottom: '2px' }}>Variedades del producto</div>
      <div style={{ fontSize: '0.8rem', color: t.subtext, marginBottom: '10px' }}>
        Pegá tu lista separada por comas (Ej: <em>mix floral, Sahumerio anís, canela y olíbano...</em>) y hacé clic en Generar. Heredarán la foto y código principal automáticamente. Dejá vacío un precio para usar el del producto principal.
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input type="text" placeholder="mix floral, Sahumerio anís..." value={textoComas} onChange={e => setTextoComas(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarPorComas(); } }} style={{ ...campo, flex: 1 }} />
        <button type="button" onClick={agregarPorComas} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>⚡ Generar por comas</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {variedades.length === 0 && <div style={{ fontSize: '0.85rem', color: t.subtext }}>Este producto no tiene variedades aún.</div>}
        {variedades.map((v: Variedad) => (
          <div key={v.id} style={{ padding: '8px', borderRadius: '10px', backgroundColor: t.row, border: `1px solid ${t.border}` }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label title="Elegir foto específica (opcional)" style={{ width: '46px', height: '46px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden', border: `1px dashed ${t.subtext}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => alElegirFoto(v.id, e)} />
                {subiendoId === v.id ? '⏳' : v.imagen_url ? <img src={v.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}
              </label>
              <input type="text" placeholder="Nombre" value={v.nombre} onChange={e => actualizar(v.id, { nombre: e.target.value })} style={{ ...campo, flex: 2 }} />
              <input type="text" placeholder="Código opcional" value={v.codigo} onChange={e => actualizar(v.id, { codigo: e.target.value })} style={{ ...campo, flex: 1, fontFamily: 'monospace' }} />
              <button type="button" onClick={() => quitar(v.id)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>🗑️</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '6px', marginTop: '8px', paddingLeft: '54px' }}>
              {([
                ['precio_costo', 'Costo'],
                ['precio_iva', '+IVA'],
                ['precio_mayorista', 'Mayorista'],
                ['precio_minorista', 'Minorista'],
              ] as const).map(([campo, etiqueta]) => (
                <label key={campo} style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <span style={{ fontSize: '0.65rem', color: t.subtext, fontWeight: 700 }}>{etiqueta}</span>
                  <input type="number" step="any" min="0" placeholder="Heredar" value={precio(v, campo)} onChange={e => setNumero(v.id, campo, e.target.value)} style={campoPrecio} />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                <span style={{ fontSize: '0.65rem', color: t.subtext, fontWeight: 700 }}>Promo</span>
                <input type="text" placeholder="Heredar" value={v.precio_promo || ''} onChange={e => setPromo(v.id, e.target.value)} style={campoPrecio} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={agregar} style={{ marginTop: '10px', padding: '9px 14px', borderRadius: '10px', border: `1px solid #3b82f6`, background: 'transparent', color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}>➕ Agregar variedad individual</button>
    </div>
  );
}

function ProductoCard({ item, darkMode, seleccionado, onToggle, onOpen, onEdit, onDelete, onDragStart, onToggleVisibilidad }: any) {
  const t = {
    card: darkMode ? '#1e293b' : '#ffffff',
    imgBg: '#ffffff',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };
  const variedades: Variedad[] = Array.isArray(item.variedades) ? item.variedades : [];
  const preciosMinoristas = variedades.map(v => Number(v.precio_minorista ?? item.precio_minorista)).filter(Number.isFinite);
  const precioMinoristaMostrado = preciosMinoristas.length > 0 ? Math.min(...preciosMinoristas) : Number(item.precio_minorista || 0);
  const tienePromo = !!(item.precio_promo && String(item.precio_promo).trim()) || variedades.some(v => !!(v.precio_promo && String(v.precio_promo).trim()));
  const plata = (v: any) => `$ ${Number(v || 0).toLocaleString('es-AR')}`;

  return (
    <div onClick={onOpen} draggable onDragStart={(e) => onDragStart && onDragStart(e, item)} title="Arrastrá esta tarjeta a una carpeta" style={{ position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: t.card, border: `1px solid ${seleccionado ? '#3b82f6' : t.border}`, borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', boxShadow: seleccionado ? '0 0 0 2px rgba(59,130,246,0.35)' : 'none' }}>
      {item.sin_stock && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.05)', zIndex: 1, pointerEvents: 'none' }} />}
      <input type="checkbox" checked={seleccionado} onChange={() => {}} onClick={(e) => onToggle(item.id, e)} style={{ position: 'absolute', top: '10px', left: '10px', width: '18px', height: '18px', zIndex: 3, cursor: 'pointer' }} />
      <span style={{ position: 'absolute', top: '10px', left: '36px', zIndex: 3, display: 'flex', alignItems: 'center', backgroundColor: darkMode ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.86)', padding: '3px 6px', borderRadius: '999px' }}>
        <OjoVisibilidad visible={item.visible_web !== false} tipo="producto" oscuro={darkMode} tamanio="0.95rem" onToggle={() => onToggleVisibilidad && onToggleVisibilidad(item)} />
      </span>

      {tienePromo && <span style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3, backgroundColor: '#dc2626', color: 'white', fontSize: '0.72rem', fontWeight: 800, padding: '6px 10px', borderRadius: '999px' }}>¡Oferta!</span>}
      {item.sin_stock && <span style={{ position: 'absolute', top: '10px', right: tienePromo ? '80px' : '10px', zIndex: 3, backgroundColor: '#374151', color: 'white', fontSize: '0.72rem', fontWeight: 800, padding: '6px 10px', borderRadius: '999px' }}>🚫 Sin Stock</span>}

      <div style={{ height: '180px', backgroundColor: t.imgBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', opacity: (item.sin_stock ? 0.6 : 1) * (item.visible_web === false ? 0.5 : 1) }}>
        {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '3rem', opacity: 0.5 }}>📦</span>}
      </div>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, zIndex: 2 }}>
        <div style={{ textAlign: 'center', fontSize: '0.92rem', fontWeight: 600, color: t.text, lineHeight: 1.3, minHeight: '2.4em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: item.visible_web === false ? 0.5 : 1 }}>{item.nombre}</div>
         <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>
           {preciosMinoristas.length > 0 && 'Desde '}{plata(precioMinoristaMostrado)}
         </div>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: t.subtext }}>Mayorista {plata(item.precio_mayorista)} · Costo {plata(item.precio_costo)}</div>
        {item.codigo && <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.72rem', color: t.subtext }}>{item.codigo}</div>}
        {variedades.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
            {variedades.slice(0, 3).map(v => <span key={v.id} style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '999px', backgroundColor: darkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9', color: t.subtext }}>{v.nombre}</span>)}
            {variedades.length > 3 && <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '999px', color: t.subtext }}>+{variedades.length - 3}</span>}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{ width: '100%', padding: '10px', borderRadius: '999px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {variedades.length > 0 ? `Ver variedades (${variedades.length})` : 'Ver detalle'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} style={{ flex: 1, padding: '7px', borderRadius: '10px', border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Editar</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} style={{ padding: '7px 12px', borderRadius: '10px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelCarpetas({
  darkMode, categorias, sel, seleccionar, conteos, totalStock, subsDe, subsubsDe,
  onCrearSub, onCrearSubSub, onRenombrarSub, onEliminarSub, onRenombrarSubSub, onEliminarSubSub, onGestionar, onDropProductos, onDropCarpeta,
  onRenombrarCategoria, onEliminarCategoria, principalesIds, onEditarCategoria, onNuevaPrincipal,
  onAlternarCategoria, onAlternarSub, onAlternarSubSub
}: any) {
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [mostrarOtras, setMostrarOtras] = useState(false);
  const [creandoEn, setCreandoEn] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [hoverDrop, setHoverDrop] = useState<string | null>(null);
  const [renombrandoCat, setRenombrandoCat] = useState<string | null>(null);
  const [nombreCat, setNombreCat] = useState('');
  const [hoverFila, setHoverFila] = useState<string | null>(null);

  // Botones de la fila: se muestran al pasar el mouse o cuando la fila esta activa.
  const accionesFila = (key: string, activa: boolean, onRenombrar: () => void, onEliminar: () => void, tituloRenombrar = 'Renombrar', tituloEliminar = 'Eliminar carpeta') => (
    activa || hoverFila === key ? (
      <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
        <button title={tituloRenombrar} onClick={(e) => { e.stopPropagation(); onRenombrar(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>✏️</button>
        <button title={tituloEliminar} onClick={(e) => { e.stopPropagation(); onEliminar(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>🗑️</button>
      </span>
    ) : null
  );

  const t = {
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    activeBg: darkMode ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)',
    hover: darkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
    input: darkMode ? '#0f172a' : '#ffffff',
  };

  const principales = categorias
    .filter((c: any) => (principalesIds || []).includes(String(c.id).toLowerCase()))
    .sort((a: any, b: any) => principalesIds.indexOf(String(a.id).toLowerCase()) - principalesIds.indexOf(String(b.id).toLowerCase()));
  const principalesFinal = principales;
  const otras = categorias.filter((c: any) => !(principalesIds || []).includes(String(c.id).toLowerCase()))
    .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label)));

  const filaBase = (activo: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px',
    cursor: 'pointer', backgroundColor: activo ? t.activeBg : 'transparent',
    color: activo ? '#3b82f6' : t.text, fontWeight: activo ? 800 : 600, fontSize: '0.9rem', userSelect: 'none'
  });

  const contador = (n: number) => <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: t.subtext, fontWeight: 600 }}>{n}</span>;
  // Las carpetas ocultas en la web se atenúan para que se vea su estado.
  const estiloOculta = (fila: any): React.CSSProperties =>
    ocultaEnWeb(fila) ? { opacity: 0.42 } : {};
  const estiloDrop = (key: string): React.CSSProperties => hoverDrop === key ? { outline: '2px dashed #3b82f6', outlineOffset: '-2px', backgroundColor: t.activeBg } : {};

  const dropProps = (key: string, catId: string, subKey: string | null, esCategoria: boolean, subsubKey: string | null = null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer.types).includes(MIME_STOCK)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (hoverDrop !== key) setHoverDrop(key);
      if (esCategoria) setAbiertas(p => (p[catId] ? p : { ...p, [catId]: true }));
    },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverDrop(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setHoverDrop(null);
      const raw = e.dataTransfer.getData(MIME_STOCK);
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (d.tipo === 'productos') onDropProductos(d.ids, catId, subKey, subsubKey);
        else if (d.tipo === 'carpeta' && esCategoria) onDropCarpeta(d.cat, d.sub, catId);
      } catch (err) { console.error('Arrastre inválido', err); }
    }
  });

  const confirmarCrear = () => {
    if (creandoEn && nombreNuevo.trim()) {
      const partes = creandoEn.split('|');
      if (partes.length === 2) onCrearSubSub(partes[0], partes[1], nombreNuevo);
      else onCrearSub(creandoEn, nombreNuevo);
    }
    setNombreNuevo(''); setCreandoEn(null);
  };

  const inputCreacion = (placeholder: string) => (
    <div style={{ padding: '4px 6px' }}>
      <input autoFocus value={nombreNuevo} placeholder={placeholder} onChange={e => setNombreNuevo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmarCrear(); if (e.key === 'Escape') { setCreandoEn(null); setNombreNuevo(''); } }} onBlur={() => confirmarCrear()} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: `1px solid #3b82f6`, backgroundColor: t.input, color: t.text, fontSize: '0.85rem', outline: 'none' }} />
    </div>
  );

  const renderCarpeta = (cat: any) => {
    const catId = String(cat.id).toLowerCase();
    const info = conteos[catId] || { total: 0, sin: 0, subs: {} };
    const estaAbierta = !!abiertas[catId];
    const catActiva = sel.cat === catId && sel.sub === null;
    const subs = subsDe(catId);
    const editando = renombrandoCat === catId;

    const confirmarRenombre = () => {
      if (editando && nombreCat.trim()) onRenombrarCategoria(catId, nombreCat);
      setRenombrandoCat(null); setNombreCat('');
    };

    return (
      <div key={catId}>
        {editando ? (
          <div style={{ padding: '4px 6px' }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={nombreCat}
              placeholder="Nuevo nombre de la categoría"
              onChange={e => setNombreCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarRenombre(); if (e.key === 'Escape') { setRenombrandoCat(null); setNombreCat(''); } }}
              onBlur={confirmarRenombre}
              style={{ width: '100%', padding: '7px 9px', borderRadius: '7px', border: '1px solid #3b82f6', backgroundColor: t.input, color: t.text, fontSize: '0.86rem', fontWeight: 700, outline: 'none' }}
            />
          </div>
        ) : (
          <div
            style={{ ...filaBase(catActiva), ...estiloDrop(catId + '|') }}
            onClick={() => { setAbiertas(p => ({ ...p, [catId]: true })); seleccionar(catId, null); }}
            onMouseEnter={() => setHoverFila(catId + '|')}
            onMouseLeave={() => setHoverFila(null)}
            {...dropProps(catId + '|', catId, null, true)}
          >
            <span onClick={(e) => { e.stopPropagation(); setAbiertas(p => ({ ...p, [catId]: !estaAbierta })); }} style={{ width: '14px', fontSize: '0.7rem', color: t.subtext }}>{estaAbierta ? '▼' : '▶'}</span>
            <span>{estaAbierta ? '📂' : '📁'}</span>
            <OjoVisibilidad visible={!ocultaEnWeb(cat)} tipo="categoria" oscuro={darkMode} onToggle={() => onAlternarCategoria(cat)} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...estiloOculta(cat) }}>{cat.label}</span>
            {(principalesIds || []).includes(catId) && (
              <span title="Categoría principal" style={{
                fontSize: '0.62rem', fontWeight: 800, color: '#7c3aed', flexShrink: 0,
                background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.4)',
                padding: '1px 6px', borderRadius: 999
              }}>★</span>
            )}
            {accionesFila(
              catId + '|',
              catActiva,
              () => onEditarCategoria(cat),
              () => onEliminarCategoria(catId, cat.label, info.total),
              'Editar categoría (nombre, imagen y principal)',
              'Eliminar categoría y subcarpetas'
            ) || contador(info.total)}
          </div>
        )}
        {estaAbierta && (
          <div style={{ marginLeft: '22px', borderLeft: `1px solid ${t.border}`, paddingLeft: '6px', marginBottom: '4px' }}>
            {subs.map((s: any) => {
              const enSub = sel.cat === catId && sel.sub === s.key;
              const activa = enSub && !sel.subsub;
              const hijos = subsubsDe(catId, s.key);
              return (
                <div key={s.key}>
                  <div draggable onDragStart={(e) => { e.dataTransfer.setData(MIME_STOCK, JSON.stringify({ tipo: 'carpeta', cat: catId, sub: s.key })); e.dataTransfer.effectAllowed = 'move'; }} style={{ ...filaBase(enSub), fontWeight: enSub ? 800 : 500, fontSize: '0.86rem', ...estiloDrop(catId + '|' + s.key) }} onClick={() => seleccionar(catId, s.key)} onMouseEnter={() => setHoverFila(catId + '|' + s.key)} onMouseLeave={() => setHoverFila(null)} {...dropProps(catId + '|' + s.key, catId, s.key, false)}>
                    <span>{enSub ? '📂' : '📁'}</span>
                    <OjoVisibilidad visible={!ocultaEnWeb(s.fila)} tipo="subcategoria" oscuro={darkMode} onToggle={() => onAlternarSub(catId, s)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...estiloOculta(s.fila) }}>{s.label}</span>
                    {accionesFila(catId + '|' + s.key, activa, () => onRenombrarSub(catId, s), () => onEliminarSub(catId, s)) || contador(s.count)}
                  </div>
                  {(hijos.length > 0 || enSub) && (
                    <div style={{ marginLeft: '18px', borderLeft: `1px solid ${t.border}`, paddingLeft: '6px', marginBottom: '4px' }}>
                      {hijos.map((h: any) => {
                        const activaH = sel.cat === catId && sel.sub === s.key && sel.subsub === h.key;
                        return (
                          <div key={h.key} style={{ ...filaBase(activaH), fontWeight: activaH ? 800 : 500, fontSize: '0.82rem', ...estiloDrop(catId + '|' + s.key + '|' + h.key) }} onClick={() => seleccionar(catId, s.key, h.key)} onMouseEnter={() => setHoverFila(catId + '|' + s.key + '|' + h.key)} onMouseLeave={() => setHoverFila(null)} {...dropProps(catId + '|' + s.key + '|' + h.key, catId, s.key, false, h.key)}>
                            <span>{activaH ? '📂' : '📁'}</span>
                            <OjoVisibilidad visible={!ocultaEnWeb(h.fila)} tipo="subsubcategoria" tamanio="0.85rem" oscuro={darkMode} onToggle={() => onAlternarSubSub(catId, s.key, h)} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...estiloOculta(h.fila) }}>{h.label}</span>
                            {accionesFila(catId + '|' + s.key + '|' + h.key, activaH, () => onRenombrarSubSub(catId, s.key, h), () => onEliminarSubSub(catId, s.key, h), 'Renombrar subcarpeta', 'Eliminar subcarpeta') || contador(h.count)}
                          </div>
                        );
                      })}
                      {enSub && (creandoEn === `${catId}|${s.key}` ? (
                        inputCreacion('Nombre de la subcarpeta')
                      ) : (
                        <div onClick={() => setCreandoEn(`${catId}|${s.key}`)} style={{ padding: '6px 10px', fontSize: '0.78rem', color: t.subtext, cursor: 'pointer', fontWeight: 600 }}>＋ Nueva subcarpeta</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {info.sin > 0 && subs.length > 0 && (
              <div style={{ ...filaBase(sel.cat === catId && sel.sub === SIN_SUB), fontSize: '0.84rem', fontWeight: 500, fontStyle: 'italic', ...estiloDrop(catId + '|sin') }} onClick={() => seleccionar(catId, SIN_SUB)} {...dropProps(catId + '|sin', catId, null, false)}>
                <span>📄</span><span>Sin subcategoría</span>{contador(info.sin)}
              </div>
            )}
            {creandoEn === catId ? (
              inputCreacion('Nombre de la carpeta')
            ) : (
              <div onClick={() => setCreandoEn(catId)} style={{ padding: '6px 10px', fontSize: '0.8rem', color: t.subtext, cursor: 'pointer', fontWeight: 600 }}>＋ Nueva subcategoría</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={filaBase(sel.cat === '')} onClick={() => seleccionar('', null)}>
        <span>🗂️</span><span>Todo el stock</span>{contador(totalStock)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '14px 10px 6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: t.subtext }}>Marcas principales</span>
        <button
          onClick={onNuevaPrincipal}
          title="Agregar una categoría principal nueva"
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8,
            border: `1px solid ${t.border}`, background: 'transparent', color: t.subtext,
            cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800
          }}
        >
          + Principal
        </button>
      </div>
      {principalesFinal.length === 0 && (
        <div style={{ padding: '8px 10px', fontSize: '0.78rem', color: t.subtext }}>
          Todavía no hay categorías principales.
        </div>
      )}
      {principalesFinal.map(renderCarpeta)}
      {otras.length > 0 && (
        <>
          <div onClick={() => setMostrarOtras(v => !v)} style={{ fontSize: '0.72rem', fontWeight: 800, color: t.subtext, padding: '14px 10px 6px', cursor: 'pointer', display: 'flex', gap: '6px' }}>
            <span>{mostrarOtras ? '▼' : '▶'}</span> Otras categorías ({otras.length})
          </div>
          {mostrarOtras && otras.map(renderCarpeta)}
        </>
      )}
      <button onClick={onGestionar} style={{ marginTop: '16px', width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
        ⚙️ Gestionar categorías
      </button>
    </div>
  );
}

export default function Stock({ stock = [], setStock, darkMode = true }: any) {
  const toast = useToast();
  const { confirmar } = toast;
  const [form, setForm] = useState({ id: '', codigo: '', nombre: '', precio_costo: '', precio_iva: '', precio_mayorista: '', precio_minorista: '', precio_promo: '', imagen_url: '', categoria: 'aromanza', subcategoria: '', subsubcategoria: '', variedades: [] as Variedad[], sin_stock: false });
  const [editando, setEditando] = useState(false);
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState<Seleccion>({ cat: '', sub: null });
  const [orden, setOrden] = useState<'nombre_asc' | 'nombre_desc' | 'codigo' | 'reciente' | 'precio_asc' | 'precio_desc'>('nombre_asc');
  const [vista, setVista] = useState<'grilla' | 'tabla'>('grilla');
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 100;
  const [isMobile, setIsMobile] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState('');

  // Catálogo mayorista completo (PDF / Excel con TODAS las categorías)
  const [opcionesCatalogo, setOpcionesCatalogo] = useState<OpcionesCatalogoCompleto>({ incluirSinStock: true, incluirVariedades: true, incluirCodigos: true, incluirOcultos: false });
  const [generandoCatalogo, setGenerandoCatalogo] = useState<'pdf' | 'excel' | null>(null);

  // --- Categorías principales editables ---
  const [modalCategoria, setModalCategoria] = useState<{ id: string; label: string; imagen_url?: string | null; es_principal?: boolean | null } | null | undefined>(undefined);
  const [soportaEsPrincipal, setSoportaEsPrincipal] = useState(true);
  // La columna `visible_web` es la que usa el ojito para ocultar cosas en la web
  // pública. `null` = todavía no se pudo comprobar, `false` = no existe en
  // Supabase (falta correr scripts/visibilidad_web.sql), `true` = disponible.
  const [soportaVisibleWeb, setSoportaVisibleWeb] = useState<boolean | null>(null);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  const [categorias, setCategorias] = useState<{ id: string; label: string; imagen_url?: string | null }[]>(CATEGORIAS_DEFAULT);

  // Ids de las categorías principales, calculadas desde los datos de Supabase.
  // Mientras la columna es_principal no exista en la base, se usa el respaldo local.
  const principalesIds = useMemo(() => {
    const marcadas = calcularPrincipales(categorias as any, PRINCIPALES_POR_DEFECTO);
    if (soportaEsPrincipal) return marcadas;
    const local = leerPrincipalesLocal();
    return local && local.length > 0 ? local : marcadas;
  }, [categorias, soportaEsPrincipal]);
  const [subcategoriasDB, setSubcategoriasDB] = useState<{ id: any; categoria: string; nombre: string }[]>([]);
  const [subsLocales, setSubsLocales] = useState<{ id: any; categoria: string; nombre: string }[]>([]);
  const [subsubsDB, setSubsubsDB] = useState<{ id: any; categoria: string; subcategoria: string; nombre: string }[]>([]);
  const [subsubLocales, setSubsubLocales] = useState<{ id: any; categoria: string; subcategoria: string; nombre: string }[]>([]);
  const [destinoMover, setDestinoMover] = useState('');
  const [mostrarModalCategorias, setMostrarModalCategorias] = useState(false);
  const [mostrarModalFormulario, setMostrarModalFormulario] = useState(false);
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);
  const [mostrarModalActualizarPrecios, setMostrarModalActualizarPrecios] = useState(false);

  const [catAumentar, setCatAumentar] = useState('aromanza');
  const [columnaAumentar, setColumnaAumentar] = useState('precio_iva');
  const [porcentajeAumento, setPorcentajeAumento] = useState('');
  const [actualizandoGlobal, setActualizandoGlobal] = useState(false);

  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [nuevaCategoriaMasiva, setNuevaCategoriaMasiva] = useState('aromanza');
  const [actualizandoCategoriaMasiva, setActualizandoCategoriaMasiva] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Las categorías principales se marcan en la columna `es_principal` y el
  // "ojito" de la web usa `visible_web`. Si alguna de las dos todavía no existe
  // en Supabase, el sistema sigue funcionando y solo se apaga esa función,
  // para que se pueda probar sin romper nada.
  const cargarCategorias = async () => {
    try {
      const completas = await supabase.from('categorias').select('id, label, orden, imagen_url, es_principal, visible_web');
      if (!completas.error && completas.data) {
        setCategorias(completas.data as any);
        setSoportaEsPrincipal(true);
        setSoportaVisibleWeb(true);
        return;
      }

      const sinOjito = await supabase.from('categorias').select('id, label, orden, imagen_url, es_principal');
      if (!sinOjito.error && sinOjito.data) {
        setCategorias(sinOjito.data as any);
        setSoportaEsPrincipal(true);
        setSoportaVisibleWeb(false);
        toast.avisar(
          'El ojito de visibilidad todavía no está disponible: falta la columna visible_web en Supabase (ejecutá scripts/visibilidad_web.sql).',
          'alerta',
          9000
        );
        return;
      }

      const { data, error } = await supabase.from('categorias').select('*');
      if (!error && data) {
        setCategorias(data as any);
        setSoportaVisibleWeb(data.length > 0 && typeof data[0] === 'object' && 'visible_web' in data[0]);
      }
      setSoportaEsPrincipal(false);
      toast.avisar(
        'Las categorías principales se guardan solo en esta computadora hasta que se agregue la columna es_principal en Supabase.',
        'alerta',
        9000
      );
    } catch (err) { console.error('Error al cargar categorías:', err); }
  };

  const cargarSubcategorias = async () => {
    try {
      const { data, error } = await supabase.from('subcategorias').select('*');
      if (!error && data) setSubcategoriasDB(data);
    } catch (err) { console.error('Error al cargar subcategorías:', err); }
  };

  const cargarSubsubcategorias = async () => {
    try {
      const { data, error } = await supabase.from('subsubcategorias').select('*');
      if (!error && data) setSubsubsDB(data);
    } catch (err) { console.error('Error al cargar sub-subcategorías:', err); }
  };

  // ---------------------------------------------------------------
  // Ojito de visibilidad en la web pública (columna `visible_web`)
  // ---------------------------------------------------------------
  // Oculto de forma efectiva = el producto está apagado, o lo está su categoría,
  // su subcategoría o su sub-subcategoría. Es lo que se usa en los catálogos.
  const ocultaEfectivaEnWeb = (p: any): boolean => {
    if (!p) return false;
    if (ocultaEnWeb(p)) return true;
    const cat = String(p.categoria || '').toLowerCase();
    const catFila = (categorias || []).find(c => String(c.id).toLowerCase() === cat);
    if (ocultaEnWeb(catFila)) return true;
    const sub = String(p.subcategoria || '').toLowerCase().trim();
    if (sub) {
      const subFila = [...subcategoriasDB, ...subsLocales].find(
        s => String(s.categoria).toLowerCase() === cat && String(s.nombre || '').trim().toLowerCase() === sub
      );
      if (ocultaEnWeb(subFila)) return true;
      const subsub = String(p.subsubcategoria || '').toLowerCase().trim();
      if (subsub) {
        const subsubFila = [...subsubsDB, ...subsubLocales].find(
          s => String(s.categoria).toLowerCase() === cat
            && String(s.subcategoria || '').toLowerCase() === sub
            && String(s.nombre || '').trim().toLowerCase() === subsub
        );
        if (ocultaEnWeb(subsubFila)) return true;
      }
    }
    return false;
  };

  // Si la columna `visible_web` todavía no existe en Supabase se explica qué
  // hacer; cualquier otro fallo se informa tal cual.
  const avisarErrorVisibilidad = (err: any) => {
    const msg = String(err?.message || '');
    if (/column|schema cache|visible_web/i.test(msg)) {
      setSoportaVisibleWeb(false);
      toast.avisar(
        'El ojito necesita la columna visible_web. Ejecutá scripts/visibilidad_web.sql en el editor SQL de Supabase y recargá la página.',
        'alerta',
        10000
      );
    } else {
      toast.error('No se pudo guardar la visibilidad en la web: ' + msg);
    }
  };

  // Escribe el cambio en Supabase y, si algo sale mal, revierte lo que se
  // mostró en pantalla.
  const alternarVisibilidad = async (
    tabla: 'categorias' | 'subcategorias' | 'subsubcategorias' | 'stock',
    id: any,
    visibleActual: boolean,
    aplicarLocal: (visible: boolean) => void
  ) => {
    // Ya se comprobó que falta la columna: no se maquilla nada en pantalla.
    if (soportaVisibleWeb === false) { avisarErrorVisibilidad({ message: 'column "visible_web" does not exist' }); return; }
    const nuevo = !visibleActual;
    aplicarLocal(nuevo); // cambio optimista
    try {
      const { error } = await supabase.from(tabla).update({ visible_web: nuevo }).eq('id', id);
      if (error) throw error;
      if (soportaVisibleWeb === null) setSoportaVisibleWeb(true);
    } catch (err: any) {
      aplicarLocal(visibleActual); // se revierte
      avisarErrorVisibilidad(err);
    }
  };

  const alternarVisibilidadCategoria = async (cat: any) => {
    if (!cat || cat.id == null) return;
    await alternarVisibilidad('categorias', cat.id, !ocultaEnWeb(cat), v =>
      setCategorias(prev => prev.map(c => String(c.id).toLowerCase() === String(cat.id).toLowerCase() ? { ...c, visible_web: v } : c))
    );
  };

  // Las carpetas que todavía no tienen fila propia (salen de los productos)
  // se dan de alta al primer toque, igual que al renombrarlas.
  const alternarVisibilidadSub = async (catId: string, carpeta: any) => {
    if (soportaVisibleWeb === false) { avisarErrorVisibilidad({ message: 'column "visible_web" does not exist' }); return; }
    const actual = !ocultaEnWeb(carpeta.fila);
    if (carpeta.fila?.id != null && !String(carpeta.fila.id).startsWith('local-')) {
      return alternarVisibilidad('subcategorias', carpeta.fila.id, actual, v =>
        setSubcategoriasDB(prev => prev.map(s => s.id === carpeta.fila.id ? { ...s, visible_web: v } : s))
      );
    }
    const nuevo = !actual;
    try {
      const { data, error } = await supabase.from('subcategorias')
        .insert([{ categoria: catId, nombre: carpeta.label, visible_web: nuevo }])
        .select().single();
      if (error) throw error;
      setSubcategoriasDB(prev => [...prev, data]);
      setSubsLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.nombre).trim().toLowerCase() === carpeta.key)));
    } catch (err: any) {
      avisarErrorVisibilidad(err);
    }
  };

  const alternarVisibilidadSubSub = async (catId: string, subKey: string, carpeta: any) => {
    if (soportaVisibleWeb === false) { avisarErrorVisibilidad({ message: 'column "visible_web" does not exist' }); return; }
    const actual = !ocultaEnWeb(carpeta.fila);
    if (carpeta.fila?.id != null && !String(carpeta.fila.id).startsWith('local-')) {
      return alternarVisibilidad('subsubcategorias', carpeta.fila.id, actual, v =>
        setSubsubsDB(prev => prev.map(s => s.id === carpeta.fila.id ? { ...s, visible_web: v } : s))
      );
    }
    const nuevo = !actual;
    try {
      const { data, error } = await supabase.from('subsubcategorias')
        .insert([{ categoria: catId, subcategoria: subKey, nombre: carpeta.label, visible_web: nuevo }])
        .select().single();
      if (error) throw error;
      setSubsubsDB(prev => [...prev, data]);
      setSubsubLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.subcategoria).toLowerCase() === subKey && String(x.nombre).trim().toLowerCase() === carpeta.key)));
    } catch (err: any) {
      avisarErrorVisibilidad(err);
    }
  };

  const alternarVisibilidadProducto = (item: any) =>
    alternarVisibilidad('stock', item.id, !ocultaEnWeb(item), v =>
      setStock((prev: any[]) => (prev || []).map(p => p.id === item.id ? { ...p, visible_web: v } : p))
    );

  useEffect(() => {
    cargarCategorias();
    cargarSubcategorias();
    cargarSubsubcategorias();
  }, []);

  const theme = {
    card: 'transparent',
    bg: darkMode ? '#0f172a' : '#f8fafc',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: 'transparent',
    input: darkMode ? '#1e293b' : '#ffffff',
    rowBorder: darkMode ? '#1e293b' : '#f1f5f9',
    innerBox: darkMode ? '#334155' : '#f8fafc'
  };

  const cardStyle: React.CSSProperties = { width: '100%', padding: '0' };
  const inputStyle: React.CSSProperties = { padding: '12px 16px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, backgroundColor: theme.input, color: theme.text, outline: 'none', fontSize: '15px', width: '100%' };
  const btnBaseStyle: React.CSSProperties = { padding: '12px 20px', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', width: isMobile ? '100%' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
  // Los menús desplegables ocupan la fila completa en el celular para que su
  // panel no se salga de la pantalla.
  const btnMenuStyle: React.CSSProperties = isMobile ? { ...btnBaseStyle, gridColumn: '1 / -1' } : btnBaseStyle;
  const menuStyleMovil: React.CSSProperties | undefined = isMobile ? { left: 0, right: 0, minWidth: 0, maxWidth: 'none' } : undefined;
  const actionBtnStyle = (color: string): React.CSSProperties => ({ background: darkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${color}`, borderRadius: '10px', color: color, cursor: 'pointer', padding: '8px 12px', fontSize: '14px' });

  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!imageUrl) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 100;
          canvas.height = img.height || 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataURL);
        } catch (err) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  // Antes de generar un catálogo, si hay productos ocultos en la web en ese
  // alcance se pregunta si se incluyen. Devuelve la decisión final.
  const preguntarOcultos = async (ocultos: number, incluirPorDefecto: boolean): Promise<boolean> => {
    if (incluirPorDefecto) return true;
    if (ocultos === 0) return false;
    const incluir = await confirmar({
      titulo: 'Productos ocultos en la web',
      mensaje: `Hay ${ocultos} producto${ocultos === 1 ? '' : 's'} oculto${ocultos === 1 ? '' : 's'} en la web en esta selección. ¿Incluirlos en el catálogo?`,
      textoOk: 'Sí, incluirlos',
      textoCancelar: 'No, excluirlos'
    });
    return !!incluir;
  };

  const generarPDFCatalogo = async (catId: string, sub: string | null = null, subsub: string | null = null) => {
    const cat = String(catId || '').toLowerCase();
    const titulo = tituloDeRuta(cat, sub, subsub);
    const disponibles = productosDeRuta(cat, sub, subsub).filter((s: any) => !s.sin_stock);
    const ocultos = disponibles.filter(ocultaEfectivaEnWeb).length;
    const incluirOcultos = await preguntarOcultos(ocultos, false);
    const productosCat = disponibles
      .filter((s: any) => incluirOcultos || !ocultaEfectivaEnWeb(s))
      .sort((a: any, b: any) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { numeric: true, sensitivity: 'base' }));

    if (productosCat.length === 0) {
      setMensajeEstado(`❌ "${titulo}" no tiene productos disponibles para el catálogo.`);
      setTimeout(() => setMensajeEstado(''), 4000);
      return;
    }

    setMensajeEstado(`Generando catálogo PDF de ${titulo}... Procesando imágenes y datos ⏳ (puede demorar unos segundos)`);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const fechaStr = new Date().toLocaleDateString('es-AR');

      const addHeader = (docRef: any, categoriaNombre: string) => {
        docRef.setFont("helvetica", "bold");
        docRef.setFontSize(16);
        docRef.setTextColor(22, 163, 74);
        docRef.text("Catálogo Mayorista Distribuidora India", pageWidth / 2, 16, { align: 'center' });
        docRef.setFontSize(11);
        docRef.setTextColor(100, 116, 139);
        docRef.text(`Lista de precios de ${categoriaNombre} - Fecha: ${fechaStr}`, pageWidth / 2, 23, { align: 'center' });
        docRef.setDrawColor(203, 213, 225);
        docRef.setLineWidth(0.5);
        docRef.line(10, 27, pageWidth - 10, 27);
      };

      addHeader(doc, titulo);

      let yPos = 32;
      let col = 0;
      const startX = [10, 105];
      const itemHeight = 16;

      for (const prod of productosCat) {
        if (yPos + itemHeight > pageHeight - 10 && col === 0) { doc.addPage(); addHeader(doc, titulo); col = 0; yPos = 32; }
        const currentX = startX[col];
        if (prod.imagen_url) {
          const imgData = await getBase64ImageFromUrl(prod.imagen_url);
          if (imgData) {
            try { doc.addImage(imgData, 'JPEG', currentX, yPos, 14, 14); } catch (imgErr) { doc.setFillColor(241, 245, 249); doc.rect(currentX, yPos, 14, 14, 'F'); }
          } else { doc.setFillColor(241, 245, 249); doc.rect(currentX, yPos, 14, 14, 'F'); }
        } else { doc.setFillColor(241, 245, 249); doc.rect(currentX, yPos, 14, 14, 'F'); }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const maxLen = 42;
        const name = prod.nombre.length > maxLen ? prod.nombre.substring(0, maxLen - 3) + "..." : prod.nombre;
        doc.text(name, currentX + 17, yPos + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(22, 163, 74);
        doc.text(`Mayorista: $${Number(prod.precio_mayorista || 0).toLocaleString('es-AR')}`, currentX + 17, yPos + 11);

        if (col === 0) col = 1;
        else { col = 0; yPos += itemHeight; }
      }

      const slugCat = normalizarCodigo(titulo).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'categoria';
      doc.save(`Catalogo_Mayorista_${slugCat}_${fechaStr.replace(/\//g, '-')}.pdf`);
      setMensajeEstado(`✅ Catálogo PDF de ${titulo} generado y descargado con éxito.`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (error) {
      console.error(error);
      setMensajeEstado('❌ Ocurrió un error al generar el PDF.');
      setTimeout(() => setMensajeEstado(''), 4000);
    }
  };

  // ---------------------------------------------------------------------
  // Catálogo mayorista COMPLETO: todos los productos en una sola descarga,
  // agrupados por categoría › subcategoría › sub-subcategoría (PDF o Excel)
  // ---------------------------------------------------------------------
  type FilaCatalogo = { codigo: string; nombre: string; precio: number; estado: string };
  type GrupoCatalogo = { titulo: string; nivel: number; sub: string; subsub: string; filas: FilaCatalogo[] };
  type BloqueCatalogo = { categoria: string; grupos: GrupoCatalogo[] };

  const precioMayoristaDe = (producto: any, variedad?: any | null): number =>
    Number(variedad?.precio_mayorista ?? producto?.precio_mayorista ?? 0) || 0;

  const construirCatalogoCompleto = (op: OpcionesCatalogoCompleto): BloqueCatalogo[] => {
    // Por defecto los productos ocultos en la web quedan fuera del catálogo;
    // el checkbox del menú (o la pregunta al generar) permite incluirlos.
    const base = (stock || []).filter((p: any) =>
      (op.incluirSinStock || !p.sin_stock) && (op.incluirOcultos || !ocultaEfectivaEnWeb(p))
    );
    const ordenar = (filas: FilaCatalogo[]) =>
      filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));

    const filasDe = (producto: any): FilaCatalogo[] => {
      const estado = producto.sin_stock ? 'Sin stock' : 'Disponible';
      const variedades = op.incluirVariedades
        ? (Array.isArray(producto.variedades) ? producto.variedades : []).filter((v: any) => v && String(v.nombre || '').trim())
        : [];
      if (variedades.length > 0) {
        return variedades.map((v: any) => ({
          codigo: normalizarCodigo(v.codigo || producto.codigo),
          nombre: `${producto.nombre} – ${v.nombre}`,
          precio: precioMayoristaDe(producto, v),
          estado
        }));
      }
      return [{
        codigo: normalizarCodigo(producto.codigo),
        nombre: String(producto.nombre || ''),
        precio: precioMayoristaDe(producto),
        estado
      }];
    };

    const bloqueDesde = (categoria: string, productos: any[]): BloqueCatalogo => {
      const grupos: GrupoCatalogo[] = [];
      const sinSub = productos.filter((p: any) => !String(p.subcategoria || '').trim());
      if (sinSub.length > 0) grupos.push({ titulo: 'Sin subcategoría', nivel: 1, sub: 'Sin subcategoría', subsub: '', filas: ordenar(sinSub.flatMap(filasDe)) });

      subsDe(String(categoria).toLowerCase()).forEach((s: { key: string; label: string }) => {
        const deSub = productos.filter((p: any) => String(p.subcategoria || '').trim().toLowerCase() === s.key);
        if (deSub.length === 0) return;
        const hijos = subsubsDe(String(categoria).toLowerCase(), s.key);
        if (hijos.length === 0) {
          grupos.push({ titulo: s.label, nivel: 1, sub: s.label, subsub: '', filas: ordenar(deSub.flatMap(filasDe)) });
          return;
        }
        const clavesHijas = new Set(hijos.map((h: { key: string }) => h.key));
        const sinHijo = deSub.filter((p: any) => {
          const ss = String(p.subsubcategoria || '').trim().toLowerCase();
          return !ss || !clavesHijas.has(ss);
        });
        if (sinHijo.length > 0) grupos.push({ titulo: s.label, nivel: 1, sub: s.label, subsub: '', filas: ordenar(sinHijo.flatMap(filasDe)) });
        hijos.forEach((h: { key: string; label: string }) => {
          const deHijo = deSub.filter((p: any) => String(p.subsubcategoria || '').trim().toLowerCase() === h.key);
          if (deHijo.length === 0) return;
          grupos.push({ titulo: `${s.label} › ${h.label}`, nivel: 2, sub: s.label, subsub: h.label, filas: ordenar(deHijo.flatMap(filasDe)) });
        });
      });

      return { categoria, grupos: grupos.filter((g) => g.filas.length > 0) };
    };

    const bloques: BloqueCatalogo[] = [];
    const idsConocidos = new Set(categorias.map((c: any) => String(c.id).toLowerCase()));

    categoriasOrdenadas.forEach((c: any) => {
      const catId = String(c.id).toLowerCase();
      const productos = base.filter((p: any) => String(p.categoria || '').toLowerCase() === catId);
      if (productos.length === 0) return;
      const bloque = bloqueDesde(catId, productos);
      if (bloque.grupos.length > 0) bloques.push(bloque);
    });

    // Productos cuya categoría no está en el panel (huérfanos o borradas)
    const huerfanos = base.filter((p: any) => !idsConocidos.has(String(p.categoria || '').toLowerCase()));
    const porCategoriaHuerfana = new Map<string, any[]>();
    huerfanos.forEach((p: any) => {
      const id = String(p.categoria || '').trim().toLowerCase();
      if (!porCategoriaHuerfana.has(id)) porCategoriaHuerfana.set(id, []);
      porCategoriaHuerfana.get(id)!.push(p);
    });
    porCategoriaHuerfana.forEach((productos, id) => {
      const etiqueta = id ? obtenerLabelCategoria(id) : '⚠️ Sin Categoría';
      const bloque = bloqueDesde(id, productos);
      if (bloque.grupos.length > 0) bloques.push({ ...bloque, categoria: etiqueta });
    });

    return bloques;
  };

  const totalFilasCatalogo = (bloques: BloqueCatalogo[]) =>
    bloques.reduce((acc, b) => acc + b.grupos.reduce((a, g) => a + g.filas.length, 0), 0);

  const generarPDFCatalogoCompleto = async (op: OpcionesCatalogoCompleto) => {
    // Alcance sin mirar ocultos: sirve para contar cuántos se preguntan.
    const alcance = (stock || []).filter((p: any) => op.incluirSinStock || !p.sin_stock);
    const opFinal = { ...op, incluirOcultos: await preguntarOcultos(alcance.filter(ocultaEfectivaEnWeb).length, op.incluirOcultos) };
    const bloques = construirCatalogoCompleto(opFinal);
    const total = totalFilasCatalogo(bloques);
    if (total === 0) {
      setMensajeEstado('❌ No hay productos para generar el catálogo completo.');
      setTimeout(() => setMensajeEstado(''), 4000);
      return;
    }

    setGenerandoCatalogo('pdf');
    setMensajeEstado(`Generando catálogo mayorista completo: ${total} productos en ${bloques.length} categorías... ⏳`);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 12;
      const fechaStr = new Date().toLocaleDateString('es-AR');

      const encabezadoPagina = (docRef: any, categoria: string, grupoTitulo: string) => {
        docRef.setFont('helvetica', 'bold');
        docRef.setFontSize(15);
        docRef.setTextColor(22, 163, 74);
        docRef.text('Catálogo Mayorista Distribuidora India', W / 2, 12, { align: 'center' });
        docRef.setFontSize(10);
        docRef.setTextColor(100, 116, 139);
        docRef.text(`Lista de precios${grupoTitulo ? ` › ${grupoTitulo}` : ''} - Fecha: ${fechaStr}`, W / 2, 18, { align: 'center' });
        docRef.setDrawColor(203, 213, 225);
        docRef.setLineWidth(0.3);
        docRef.line(M, 22, W - M, 22);
        docRef.setFontSize(8);
        docRef.setTextColor(148, 163, 184);
        docRef.text(categoria, M, 27);
        return 34;
      };

      const repetirGrupo = (y: number, categoria: string, grupoTitulo: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(79, 70, 229);
        doc.text(grupoTitulo, M, y);
        const yTitulo = y + 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(M, yTitulo, W - M, yTitulo);
        return yTitulo + 5;
      };

      bloques.forEach((bloque, indiceBloque) => {
        if (indiceBloque > 0) doc.addPage();
        let y = encabezadoPagina(doc, bloque.categoria, '');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(15, 23, 42);
        doc.text(bloque.categoria, M, y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const filasBloque = bloque.grupos.reduce((a, g) => a + g.filas.length, 0);
        doc.text(`${filasBloque} producto${filasBloque === 1 ? '' : 's'} - Precios en pesos (ARS)`, M, y + 5);
        y += 9;
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.6);
        doc.line(M, y, W - M, y);
        y += 6;

        bloque.grupos.forEach((grupo) => {
          if (y + 16 > H - 14) { doc.addPage(); y = encabezadoPagina(doc, bloque.categoria, grupo.titulo); y = repetirGrupo(y, bloque.categoria, grupo.titulo); }
          y = repetirGrupo(y, bloque.categoria, grupo.titulo);

          grupo.filas.forEach((fila, indiceFila) => {
            if (y + 7 > H - 12) { doc.addPage(); y = encabezadoPagina(doc, bloque.categoria, grupo.titulo); y = repetirGrupo(y, bloque.categoria, grupo.titulo); }
            if (indiceFila % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 3.6, W - M * 2, 7, 'F'); }

            let x = M + 2;
            if (op.incluirCodigos && fila.codigo) {
              doc.setFont('courier', 'normal');
              doc.setFontSize(7.5);
              doc.setTextColor(148, 163, 184);
              doc.text(String(fila.codigo), x, y);
              x += 26;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            const partes = doc.splitTextToSize(fila.nombre, W - M - 76 - x);
            doc.text(partes[0], x, y);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(22, 163, 74);
            doc.text(`$${fila.precio.toLocaleString('es-AR')}`, W - M - 2, y, { align: 'right' });

            if (fila.estado !== 'Disponible') {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.5);
              doc.setTextColor(220, 38, 38);
              doc.text('AGOTADO', M + 2, y + 3.4);
            }
            y += 7;
          });
          y += 5;
        });
      });

      const totalPaginas = doc.getNumberOfPages();
      for (let p = 1; p <= totalPaginas; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Catálogo Mayorista Distribuidora India', M, H - 6);
        doc.text(`Página ${p} de ${totalPaginas}`, W - M, H - 6, { align: 'right' });
      }

      doc.save(`Catalogo_Mayorista_Completo_${fechaStr.replace(/\//g, '-')}.pdf`);
      setMensajeEstado(`✅ Catálogo mayorista completo descargado: ${total} productos, ${bloques.length} categorías.`);
      setTimeout(() => setMensajeEstado(''), 5000);
    } catch (error) {
      console.error(error);
      setMensajeEstado('❌ Ocurrió un error al generar el PDF completo.');
      setTimeout(() => setMensajeEstado(''), 4000);
    } finally {
      setGenerandoCatalogo(null);
    }
  };

  const generarExcelCatalogoCompleto = async (op: OpcionesCatalogoCompleto) => {
    const alcance = (stock || []).filter((p: any) => op.incluirSinStock || !p.sin_stock);
    const opFinal = { ...op, incluirOcultos: await preguntarOcultos(alcance.filter(ocultaEfectivaEnWeb).length, op.incluirOcultos) };
    const bloques = construirCatalogoCompleto(opFinal);
    const total = totalFilasCatalogo(bloques);
    if (total === 0) {
      setMensajeEstado('❌ No hay productos para generar el Excel completo.');
      setTimeout(() => setMensajeEstado(''), 4000);
      return;
    }

    setGenerandoCatalogo('excel');
    setMensajeEstado(`Generando Excel mayorista completo: ${total} productos... ⏳`);
    try {
      const fechaStr = new Date().toLocaleDateString('es-AR');
      const libro = XLSX.utils.book_new();
      const nombresUsados = new Set<string>();

      const nombreHoja = (titulo: string) => {
        let base = String(titulo).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
        let nombre = base;
        let n = 2;
        while (nombresUsados.has(nombre.toLowerCase())) {
          const sufijo = ` (${n})`;
          nombre = base.slice(0, 31 - sufijo.length) + sufijo;
          n++;
        }
        nombresUsados.add(nombre.toLowerCase());
        return nombre;
      };

      const cabecera = ['Categoría', 'Subcategoría', 'Sub-Subcategoría', ...(op.incluirCodigos ? ['Código'] : []), 'Producto', 'Precio Mayorista ($)', 'Estado'];
      const resumen: any[][] = [['Categoría', 'Cantidad de productos']];

      bloques.forEach((bloque) => {
        const filas: any[][] = [cabecera];
        let count = 0;
        bloque.grupos.forEach((grupo) => {
          grupo.filas.forEach((fila) => {
            filas.push([
              bloque.categoria,
              grupo.sub,
              grupo.subsub,
              ...(op.incluirCodigos ? [fila.codigo] : []),
              fila.nombre,
              fila.precio,
              fila.estado
            ]);
            count++;
          });
        });
        resumen.push([bloque.categoria, count]);
        const hoja = XLSX.utils.aoa_to_sheet(filas);
        hoja['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 20 }, ...(op.incluirCodigos ? [{ wch: 16 }] : []), { wch: 48 }, { wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(bloque.categoria));
      });

      resumen.push(['TOTAL', total]);
      const hojaResumen = XLSX.utils.aoa_to_sheet(resumen);
      hojaResumen['!cols'] = [{ wch: 30 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

      XLSX.writeFile(libro, `Catalogo_Mayorista_Completo_${fechaStr.replace(/\//g, '-')}.xlsx`);
      setMensajeEstado(`✅ Excel mayorista completo descargado: ${total} productos en ${bloques.length} categorías.`);
      setTimeout(() => setMensajeEstado(''), 5000);
    } catch (error) {
      console.error(error);
      setMensajeEstado('❌ Ocurrió un error al generar el Excel completo.');
      setTimeout(() => setMensajeEstado(''), 4000);
    } finally {
      setGenerandoCatalogo(null);
    }
  };

  // ---------------------------------------------------------------------
  // Códigos de barras: generación, guardado y PDF de etiquetas
  // ---------------------------------------------------------------------
  const codigosOcupados = (productos: any[]): Set<string> => {
    const set = new Set<string>();
    (productos || []).forEach((p: any) => {
      const c = String(p?.codigo || '').trim().toLowerCase();
      if (c) set.add(c);
      (Array.isArray(p?.variedades) ? p.variedades : []).forEach((v: any) => {
        const cv = String(v?.codigo || '').trim().toLowerCase();
        if (cv) set.add(cv);
      });
    });
    return set;
  };

  const generarCodigoUnico = (ocupados: Set<string>): string => {
    let n = 1;
    let codigo = '';
    do {
      codigo = `IND-${String(n).padStart(6, '0')}`;
      n++;
    } while (ocupados.has(codigo.toLowerCase()));
    ocupados.add(codigo.toLowerCase());
    return codigo;
  };

  // Asigna código a los productos que no tengan uno y lo guarda en la base de datos.
  const asegurarCodigos = async (productos: any[]): Promise<any[]> => {
    const faltantes = (productos || []).filter(p => !String(p.codigo || '').trim());
    if (faltantes.length === 0) return productos;

    const ocupados = codigosOcupados([...(productos || []), ...(stock || [])]);
    const asignados: { id: any; codigo: string }[] = [];
    faltantes.forEach(p => asignados.push({ id: p.id, codigo: generarCodigoUnico(ocupados) }));

    const nombres = new Map<any, string>();
    [...(productos || []), ...(stock || [])].forEach((p: any) => {
      const n = String(p?.nombre || '').trim();
      if (p?.id !== undefined && n && !nombres.has(p.id)) nombres.set(p.id, n);
    });

    let errorGuardado: string | null = null;
    for (let i = 0; i < asignados.length; i += 200) {
      const chunk = asignados.slice(i, i + 200);
      const filas = chunk.filter(a => nombres.has(a.id)).map(a => ({ id: a.id, nombre: nombres.get(a.id), codigo: a.codigo }));
      if (filas.length === 0) continue;
      const { error } = await supabase.from('stock').upsert(filas, { onConflict: 'id' });
      if (error) {
        for (const a of chunk) {
          const { error: errItem } = await supabase.from('stock').update({ codigo: a.codigo }).eq('id', a.id);
          if (errItem) errorGuardado = errItem.message;
        }
      }
    }
    if (errorGuardado) console.error('No se pudieron guardar todos los códigos:', errorGuardado);

    const mapa = new Map(asignados.map(a => [a.id, a.codigo]));
    setStock((prev: any[]) => (prev || []).map(p => mapa.has(p.id) ? { ...p, codigo: mapa.get(p.id) } : p));
    return (productos || []).map(p => mapa.has(p.id) ? { ...p, codigo: mapa.get(p.id) } : p);
  };

  // Genera y guarda el código de barras de los productos que todavía no tengan uno.
  const codigosAutoHechos = useRef(false);
  useEffect(() => {
    if (codigosAutoHechos.current) return;
    const productos = stock || [];
    if (productos.length === 0) return;
    codigosAutoHechos.current = true;
    if (!productos.some((p: any) => !String(p?.codigo || '').trim())) return;
    asegurarCodigos(productos).catch((err: any) => console.error('No se pudieron generar los códigos automáticos:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock]);

  // Cambia (o genera) el código de un producto desde el modal de información.
  const actualizarCodigoProducto = async (item: any, valor: string | null): Promise<{ ok: boolean; codigo?: string; error?: string }> => {
    try {
      let codigoFinal: string;
      const limpio = valor === null ? '' : normalizarCodigo(valor);
      if (!limpio) {
        const ocupados = codigosOcupados(stock || []);
        codigoFinal = generarCodigoUnico(ocupados);
      } else {
        codigoFinal = limpio;
        const duplicado = (stock || []).some((p: any) =>
          p.id !== item.id && String(p.codigo || '').trim().toLowerCase() === codigoFinal.toLowerCase()
        );
        if (duplicado) return { ok: false, error: `Ya existe otro producto con el código "${codigoFinal}". Elegí uno distinto.` };
      }

      const { error } = await supabase.from('stock').update({ codigo: codigoFinal }).eq('id', item.id);
      if (error) return { ok: false, error: error.message };

      setStock((prev: any[]) => (prev || []).map(p => p.id === item.id ? { ...p, codigo: codigoFinal } : p));
      setProductoSeleccionado((prev: any) => (prev && prev.id === item.id ? { ...prev, codigo: codigoFinal } : prev));
      return { ok: true, codigo: codigoFinal };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error inesperado al guardar el código.' };
    }
  };

  const productosDeRuta = (cat: string, sub: string | null, subsub: string | null = null) =>
    (stock || []).filter((p: any) => {
      if (String(p.categoria || '').toLowerCase() !== cat) return false;
      if (sub === null) return true;
      const s = String(p.subcategoria || '').toLowerCase().trim();
      if (sub === SIN_SUB) return !s;
      if (s !== sub) return false;
      if (subsub) return String(p.subsubcategoria || '').toLowerCase().trim() === subsub;
      return true;
    });

  const tituloDeRuta = (cat: string, sub: string | null, subsub: string | null = null) => {
    let titulo = obtenerLabelCategoria(cat);
    if (sub === SIN_SUB) return `${titulo} › Sin subcategoría`;
    if (sub) {
      const etiquetaSub = subsDe(cat).find(x => x.key === sub);
      titulo += ` › ${etiquetaSub ? etiquetaSub.label : capitalizar(sub)}`;
      if (subsub) {
        const etiquetaSubSub = subsubsDe(cat, sub).find(x => x.key === subsub);
        titulo += ` › ${etiquetaSubSub ? etiquetaSubSub.label : capitalizar(subsub)}`;
      }
    }
    return titulo;
  };

  const generarPDFEtiquetas = async (productosOriginales: any[], titulo: string) => {
    const productos = (productosOriginales || []).filter(Boolean);
    if (productos.length === 0) {
      setMensajeEstado('❌ No hay productos en la selección para imprimir.');
      setTimeout(() => setMensajeEstado(''), 4000);
      return;
    }

    setMensajeEstado(`Preparando ${productos.length} etiquetas con código de barras... ⏳`);
    try {
      const productosConCodigo = await asegurarCodigos(productos);
      const ordenados = productosConCodigo
        .filter((p: any) => normalizarCodigo(p.codigo))
        .sort((a: any, b: any) =>
          String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { numeric: true, sensitivity: 'base' })
        );

      if (ordenados.length === 0) {
        setMensajeEstado('❌ No se pudieron obtener códigos de barras para imprimir.');
        setTimeout(() => setMensajeEstado(''), 4000);
        return;
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const fechaStr = new Date().toLocaleDateString('es-AR');
      const dibujadas = dibujarEtiquetasEnDoc(doc, ordenados);

      const slug = normalizarCodigo(titulo).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'seleccion';
      doc.save(`Etiquetas_Codigos_Barra_${slug}_${fechaStr.replace(/\//g, '-')}.pdf`);

      const sinCodigo = productos.length - ordenados.length;
      setMensajeEstado(`✅ ${dibujadas} etiquetas generadas${sinCodigo > 0 ? ` (${sinCodigo} productos sin código se saltearon)` : ''} en PDF: ${titulo}`);
      setTimeout(() => setMensajeEstado(''), 6000);
    } catch (error) {
      console.error(error);
      setMensajeEstado('❌ Ocurrió un error al generar las etiquetas.');
      setTimeout(() => setMensajeEstado(''), 4000);
    }
  };

  const imprimirEtiquetasDeRuta = ({ cat, sub, subsub }: { cat: string; sub: string | null; subsub?: string | null }) => {
    if (!cat) return;
    generarPDFEtiquetas(productosDeRuta(cat, sub, subsub || null), tituloDeRuta(cat, sub, subsub || null));
  };

  const imprimirEtiquetasSeleccionados = () => {
    const prods = (stock || []).filter((p: any) => seleccionados.includes(p.id));
    generarPDFEtiquetas(prods, `Selección de ${prods.length} productos`);
  };

  // Sube una imagen ya optimizada (recortada al centro y comprimida) al bucket
  // de productos. La optimizacion ocurre en lib/imageUtils.
  const subirImagen = async (archivoOriginal: File): Promise<string | null> => {
    try {
      const archivo = await prepararImagenRedimensionada(archivoOriginal, 1200);
      return await subirArchivoAStorage(supabase, 'productos-imagenes', archivo);
    } catch (e) { console.error("Excepción en subirImagen:", e); return null; }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubiendoImagen(true);
    let imagenFinal = form.imagen_url;
    if (imagenArchivo) {
      const urlSubida = await subirImagen(imagenArchivo);
      if (urlSubida) imagenFinal = urlSubida;
    }

    const datosProcesados = {
      codigo: form.codigo.trim() || null,
      nombre: form.nombre,
      precio_costo: form.precio_costo !== '' ? Number(form.precio_costo) : 0,
      precio_iva: form.precio_iva !== '' ? Number(form.precio_iva) : 0,
      precio_mayorista: form.precio_mayorista !== '' ? Number(form.precio_mayorista) : 0,
      precio_minorista: form.precio_minorista !== '' ? Number(form.precio_minorista) : 0,
      precio_promo: form.precio_promo ? form.precio_promo.trim().toLowerCase() : null,
      categoria: form.categoria.toLowerCase().trim(),
      subcategoria: form.subcategoria ? form.subcategoria.toLowerCase().trim() : null,
      subsubcategoria: form.subsubcategoria ? form.subsubcategoria.toLowerCase().trim() : null,
      imagen_url: imagenFinal || null,
      variedades: (form.variedades || []).filter(v => v.nombre.trim() !== '').map((v: Variedad) => {
        const salida: any = { id: v.id, nombre: v.nombre.trim(), codigo: v.codigo.trim(), imagen_url: v.imagen_url || '' };
        if (v.precio_costo !== undefined && v.precio_costo !== null) salida.precio_costo = Number(v.precio_costo);
        if (v.precio_iva !== undefined && v.precio_iva !== null) salida.precio_iva = Number(v.precio_iva);
        if (v.precio_mayorista !== undefined && v.precio_mayorista !== null) salida.precio_mayorista = Number(v.precio_mayorista);
        if (v.precio_minorista !== undefined && v.precio_minorista !== null) salida.precio_minorista = Number(v.precio_minorista);
        if (v.precio_promo !== undefined && v.precio_promo !== null && v.precio_promo !== '') salida.precio_promo = String(v.precio_promo).trim().toLowerCase();
        return salida;
      }),
      sin_stock: form.sin_stock || false,
      ultima_actualizacion: new Date().toLocaleString()
    };

    try {
      let dataRes, errorRes;
      if (form.id) {
        const res = await supabase.from('stock').update(datosProcesados).eq('id', form.id).select().single();
        dataRes = res.data; errorRes = res.error;
      } else {
        const res = await supabase.from('stock').insert([datosProcesados]).select().single();
        dataRes = res.data; errorRes = res.error;
      }
      if (errorRes) throw errorRes;

      if (editando) setStock((stock || []).map((item: any) => item.id === form.id ? { ...item, ...dataRes } : item));
      else setStock([...(stock || []), dataRes]);
      
      resetForm();
      toast.exito("Producto guardado correctamente.");
    } catch (err: any) { toast.error("Error al guardar: " + err.message); } 
    finally { setSubiendoImagen(false); }
  };

  const resetForm = () => {
    setForm({ id: '', codigo: '', nombre: '', precio_costo: '', precio_iva: '', precio_mayorista: '', precio_minorista: '', precio_promo: '', imagen_url: '', categoria: 'aromanza', subcategoria: '', subsubcategoria: '', variedades: [], sin_stock: false });
    setImagenArchivo(null); setEditando(false); if (fileInputRef.current) fileInputRef.current.value = '';
    setMostrarModalFormulario(false);
  };

  const abrirFormularioNuevo = () => {
    resetForm();
    setForm(f => ({ ...f, categoria: sel.cat || 'aromanza', subcategoria: sel.sub && sel.sub !== SIN_SUB ? sel.sub : '', subsubcategoria: sel.subsub || '' }));
    setMostrarModalFormulario(true);
  };

  const activarEdicion = (item: any) => {
    setForm({
      id: item.id || '', codigo: item.codigo || '', nombre: item.nombre || '',
      precio_costo: item.precio_costo ?? '', precio_iva: item.precio_iva ?? '', precio_mayorista: item.precio_mayorista ?? '', precio_minorista: item.precio_minorista ?? '',
      precio_promo: item.precio_promo || '', imagen_url: item.imagen_url || '',       categoria: item.categoria || 'aromanza', subcategoria: item.subcategoria || '',
      subsubcategoria: item.subsubcategoria || '',
      variedades: Array.isArray(item.variedades) ? item.variedades : [],
      sin_stock: item.sin_stock || false
    });
    setImagenArchivo(null); setEditando(true); setMostrarModalFormulario(true);
  };

  const borrarItem = async (id: string) => {
    if (await confirmar({ titulo: 'Eliminar artículo', mensaje: '¿Seguro que querés eliminar este artículo?', textoOk: 'Eliminar', peligro: true })) {
      try {
        const { error } = await supabase.from('stock').delete().eq('id', id);
        if (error) throw error;
        setStock((stock || []).filter((item: any) => item.id !== id));
      } catch (err: any) { toast.error("Error al eliminar: " + err.message); }
    }
  };


  // ========================================================================
  // Categorías: editar (nombre / imagen / principal) y crear una nueva
  // ========================================================================
  const guardarCategoria = async (datos: {
    id?: string; label: string; imagen_url: string | null; es_principal: boolean; archivo?: File | null;
  }) => {
    const label = datos.label.trim();
    if (!label) return;

    setGuardandoCategoria(true);
    try {
      let imagenFinal = datos.imagen_url || null;
      if (datos.archivo) {
        const urlSubida = await subirImagen(datos.archivo);
        if (!urlSubida) {
          toast.error('No se pudo subir la imagen de la categoría.');
          return;
        }
        imagenFinal = urlSubida;
      }

      // --- Alta de categoría nueva ---
      if (!datos.id) {
        const nuevoId = generarIdCategoria(label);
        if (!nuevoId) {
          toast.avisar('Ese nombre no sirve como identificador de categoría.', 'alerta');
          return;
        }
        const existe = categorias.some((c: any) => String(c.id).toLowerCase() === nuevoId);
        if (existe) {
          toast.avisar('Ya existe una categoría con ese nombre.', 'alerta');
          return;
        }

        const payload: any = { id: nuevoId, label, imagen_url: imagenFinal };
        if (soportaEsPrincipal) payload.es_principal = datos.es_principal;
        const { error } = await supabase.from('categorias').insert([payload]);
        if (error) throw error;

        if (!soportaEsPrincipal && datos.es_principal) {
          guardarPrincipalesLocal([...leerPrincipalesLocal() || PRINCIPALES_POR_DEFECTO, nuevoId]);
        }
        await cargarCategorias();
        setModalCategoria(undefined);
        toast.exito(`Categoría "${label}" creada${datos.es_principal ? ' como principal' : ''}.`);
        return;
      }

      // --- Edición ---
      const updates: any = { label, imagen_url: imagenFinal };
      if (soportaEsPrincipal) updates.es_principal = datos.es_principal;
      const { error } = await supabase.from('categorias').update(updates).eq('id', datos.id);
      if (error) throw error;

      if (!soportaEsPrincipal) {
        const actuales = leerPrincipalesLocal() || PRINCIPALES_POR_DEFECTO;
        guardarPrincipalesLocal(
          datos.es_principal
            ? Array.from(new Set([...actuales, datos.id!.toLowerCase()]))
            : actuales.filter((id) => id !== datos.id!.toLowerCase())
        );
      }

      await cargarCategorias();
      setModalCategoria(undefined);
      toast.exito('Categoría actualizada.');
    } catch (err: any) {
      toast.error('No se pudo guardar la categoría: ' + (err?.message || 'error desconocido'));
    } finally {
      setGuardandoCategoria(false);
    }
  };

  const abrirEdicionCategoria = (cat: any) => {
    setModalCategoria({ id: String(cat.id), label: cat.label || '', imagen_url: cat.imagen_url || '', es_principal: Boolean(cat.es_principal) });
  };

  const abrirNuevaPrincipal = () => setModalCategoria(null);

  const obtenerLabelCategoria = (idCat: string) => {
    if (!idCat) return '⚠️ Sin Categoría';
    const encontrada = categorias.find(c => String(c.id).toLowerCase() === String(idCat).toLowerCase());
    return encontrada ? encontrada.label : idCat;
  };

  const crearCategoria = async (nombre: string, imagenArchivo?: File | null, imagenUrl?: string) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      toast.avisar('Ingresá un nombre.', 'alerta');
      return false;
    }
    const id = nombreLimpio.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    try {
      let imagenFinal = imagenUrl?.trim() || null;
      if (imagenArchivo) {
        const urlSubida = await subirImagen(imagenArchivo);
        if (!urlSubida) {
          toast.error('No se pudo subir la imagen de la categoría.');
          return false;
        }
        imagenFinal = urlSubida;
      }
      const { error } = await supabase.from('categorias').insert([{ id, label: nombreLimpio, imagen_url: imagenFinal }]);
      if (error) throw error;
      await cargarCategorias();
      return true;
    } catch (err: any) {
      toast.error('Error: ' + err.message);
      return false;
    }
  };

  const actualizarCategoria = async (id: string, nuevoLabel: string, imagenArchivo?: File | null, imagenUrl?: string) => {
    const labelLimpio = nuevoLabel.trim();
    if (!labelLimpio) {
      toast.avisar('Ingresá un nombre.', 'alerta');
      return false;
    }
    try {
      let imagenFinal = imagenUrl?.trim() || null;
      if (imagenArchivo) {
        const urlSubida = await subirImagen(imagenArchivo);
        if (!urlSubida) {
          toast.error('No se pudo subir la imagen de la categoría.');
          return false;
        }
        imagenFinal = urlSubida;
      }
      const { error } = await supabase.from('categorias').update({ label: labelLimpio, imagen_url: imagenFinal }).eq('id', id);
      if (error) throw error;
      await cargarCategorias();
      return true;
    } catch (err: any) {
      toast.error('Error: ' + err.message);
      return false;
    }
  };

  const eliminarCategoria = async (id: string) => {
    try {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
      await cargarCategorias();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  // Renombra la etiqueta visible de una categoría. El `id` no se toca, así que
  // los productos que la apuntan siguen intactos.
  const renombrarCategoria = async (id: string, nuevoLabel: string) => {
    const labelLimpio = nuevoLabel.trim();
    if (!labelLimpio || labelLimpio === id) return;
    try {
      const { error } = await supabase.from('categorias').update({ label: labelLimpio }).eq('id', id);
      if (error) throw error;
      await cargarCategorias();
      setMensajeEstado(`✅ Categoría renombrada a "${labelLimpio}"`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  // Elimina la categoría y sus subcarpetas. Los productos NO se borran: quedan
  // con la categoría anterior y el usuario decide después a dónde mudarlos.
  const eliminarCategoriaConHijos = async (id: string, label: string, cantProductos: number) => {
    const msg = cantProductos > 0
      ? `Se va a eliminar la categoría "${label}" y sus subcarpetas.\n\n` +
        `Hay ${cantProductos} producto(s) dentro. NO se van a borrar, pero quedarán ` +
        `sin categoría visible en el panel hasta que los muevas a otra carpeta.\n\n` +
        `¿Querés continuar igual?`
      : `Se va a eliminar la categoría "${label}" y sus subcarpetas.\n\n¿Querés continuar?`;
    if (!(await confirmar({ titulo: 'Eliminar categoría', mensaje: msg.replace(/\n+/g, ' '), textoOk: 'Sí, eliminar', peligro: true }))) return;
    try {
      await supabase.from('subcategorias').delete().eq('categoria', id);
      await supabase.from('subsubcategorias').delete().eq('categoria', id);
      await eliminarCategoria(id);
      await cargarSubcategorias();
      await cargarSubsubcategorias();
      setSel({ cat: '', sub: null });
      setMensajeEstado(`🗑️ Categoría "${label}" eliminada`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const conteos = useMemo(() => {
    const m: Record<string, { total: number; sin: number; subs: Record<string, number>; hijos: Record<string, Record<string, number>> }> = {};
    (stock || []).forEach((it: any) => {
      const c = String(it.categoria || '').toLowerCase();
      if (!m[c]) m[c] = { total: 0, sin: 0, subs: {}, hijos: {} };
      m[c].total++;
      const s = String(it.subcategoria || '').toLowerCase().trim();
      const ss = String(it.subsubcategoria || '').toLowerCase().trim();
      if (s) {
        m[c].subs[s] = (m[c].subs[s] || 0) + 1;
        if (ss) {
          if (!m[c].hijos[s]) m[c].hijos[s] = {};
          m[c].hijos[s][ss] = (m[c].hijos[s][ss] || 0) + 1;
        }
      } else m[c].sin++;
    });
    return m;
  }, [stock]);

  const subsDe = (catId: string) => {
    // Además del nombre se conserva la fila de la base (`fila`), que es la que
    // tiene el ojito de visibilidad en la web. Las carpetas que solo salen de
    // los productos quedan sin fila hasta que se crean.
    const mapa = new Map<string, { label: string; fila?: any }>();
    [...subcategoriasDB, ...subsLocales]
      .filter(s => String(s.categoria).toLowerCase() === catId)
      .forEach(s => mapa.set(String(s.nombre).trim().toLowerCase(), { label: String(s.nombre).trim(), fila: s }));
    Object.keys(conteos[catId]?.subs || {}).forEach(k => {
      if (!mapa.has(k)) mapa.set(k, { label: capitalizar(k) });
    });
    return Array.from(mapa.entries())
      .map(([key, v]) => ({ key, label: v.label, fila: v.fila, count: conteos[catId]?.subs[key] || 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const subsubsDe = (catId: string, subKey: string) => {
    const mapa = new Map<string, { label: string; fila?: any }>();
    [...subsubsDB, ...subsubLocales]
      .filter(s => String(s.categoria).toLowerCase() === catId && String(s.subcategoria).toLowerCase() === subKey)
      .forEach(s => mapa.set(String(s.nombre).trim().toLowerCase(), { label: String(s.nombre).trim(), fila: s }));
    Object.keys(conteos[catId]?.hijos?.[subKey] || {}).forEach(k => {
      if (!mapa.has(k)) mapa.set(k, { label: capitalizar(k) });
    });
    return Array.from(mapa.entries())
      .map(([key, v]) => ({ key, label: v.label, fila: v.fila, count: conteos[catId]?.hijos?.[subKey]?.[key] || 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const seleccionar = (cat: string, sub: string | null, subsub: string | null = null) => { setSel({ cat, sub, subsub }); setBusqueda(''); setPaginaActual(1); if (isMobile) setPanelAbierto(false); };

  const crearSubcategoria = async (catId: string, nombre: string) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    if (subsDe(catId).some(s => s.key === limpio.toLowerCase())) return toast.avisar('Ya existe una carpeta con ese nombre.', 'alerta');
    try {
      const { data, error } = await supabase.from('subcategorias').insert([{ categoria: catId, nombre: limpio }]).select().single();
      if (error) throw error;
      setSubcategoriasDB(prev => [...prev, data]);
      seleccionar(catId, limpio.toLowerCase());
    } catch (err: any) {
      setSubsLocales(prev => [...prev, { id: `local-${nuevoId()}`, categoria: catId, nombre: limpio }]);
      seleccionar(catId, limpio.toLowerCase());
    }
  };

  const crearSubsubcategoria = async (catId: string, subKey: string, nombre: string) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    if (subsubsDe(catId, subKey).some(s => s.key === limpio.toLowerCase())) return toast.avisar('Ya existe una subcarpeta con ese nombre.', 'alerta');
    try {
      const { data, error } = await supabase.from('subsubcategorias').insert([{ categoria: catId, subcategoria: subKey, nombre: limpio }]).select().single();
      if (error) throw error;
      setSubsubsDB(prev => [...prev, data]);
      seleccionar(catId, subKey, limpio.toLowerCase());
    } catch (err: any) {
      setSubsubLocales(prev => [...prev, { id: `local-${nuevoId()}`, categoria: catId, subcategoria: subKey, nombre: limpio }]);
      seleccionar(catId, subKey, limpio.toLowerCase());
    }
  };

  const renombrarSubsubcategoria = async (catId: string, subKey: string, hijo: { key: string; label: string }) => {
    const nuevo = window.prompt('Nuevo nombre de la subcarpeta:', hijo.label);
    if (!nuevo || !nuevo.trim() || nuevo.trim() === hijo.label) return;
    const nuevoLimpio = nuevo.trim();
    const nuevoKey = nuevoLimpio.toLowerCase();
    if (nuevoKey !== hijo.key && subsubsDe(catId, subKey).some(s => s.key === nuevoKey)) return toast.avisar('Ya existe una carpeta con ese nombre.', 'alerta');
    try {
      const { error: errStock } = await supabase.from('stock').update({ subsubcategoria: nuevoKey }).eq('categoria', catId).eq('subcategoria', subKey).eq('subsubcategoria', hijo.key);
      if (errStock) throw errStock;
      const fila = subsubsDB.find(s => String(s.categoria).toLowerCase() === catId && String(s.subcategoria).toLowerCase() === subKey && String(s.nombre).trim().toLowerCase() === hijo.key);
      if (fila) {
        const { error: errFila } = await supabase.from('subsubcategorias').update({ nombre: nuevoLimpio }).eq('id', fila.id);
        if (errFila) throw errFila;
      } else { await supabase.from('subsubcategorias').insert([{ categoria: catId, subcategoria: subKey, nombre: nuevoLimpio }]); }
      await cargarSubsubcategorias();
      setSubsubLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.subcategoria).toLowerCase() === subKey && String(x.nombre).trim().toLowerCase() === hijo.key)));
      setStock((stock || []).map((it: any) => String(it.categoria).toLowerCase() === catId && String(it.subcategoria || '').toLowerCase().trim() === subKey && String(it.subsubcategoria || '').toLowerCase().trim() === hijo.key ? { ...it, subsubcategoria: nuevoKey } : it));
      setSel({ cat: catId, sub: subKey, subsub: nuevoKey });
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const eliminarSubsubcategoria = async (catId: string, subKey: string, hijo: { key: string; label: string; count: number }) => {
    const aviso = hijo.count > 0 ? `¿Eliminar la subcarpeta "${hijo.label}"?\nLos ${hijo.count} productos NO se borran.` : `¿Eliminar la subcarpeta vacía "${hijo.label}"?`;
    if (!(await confirmar({ titulo: 'Eliminar subcarpeta', mensaje: aviso.replace(/\n+/g, ' '), textoOk: 'Sí, eliminar', peligro: true }))) return;
    try {
      const { error: errStock } = await supabase.from('stock').update({ subsubcategoria: null }).eq('categoria', catId).eq('subcategoria', subKey).eq('subsubcategoria', hijo.key);
      if (errStock) throw errStock;
      const fila = subsubsDB.find(s => String(s.categoria).toLowerCase() === catId && String(s.subcategoria).toLowerCase() === subKey && String(s.nombre).trim().toLowerCase() === hijo.key);
      if (fila) await supabase.from('subsubcategorias').delete().eq('id', fila.id);
      await cargarSubsubcategorias();
      setSubsubLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.subcategoria).toLowerCase() === subKey && String(x.nombre).trim().toLowerCase() === hijo.key)));
      setStock((stock || []).map((it: any) => String(it.categoria).toLowerCase() === catId && String(it.subcategoria || '').toLowerCase().trim() === subKey && String(it.subsubcategoria || '').toLowerCase().trim() === hijo.key ? { ...it, subsubcategoria: null } : it));
      setSel({ cat: catId, sub: subKey, subsub: null });
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const renombrarSubcategoria = async (catId: string, sub: { key: string; label: string }) => {
    const nuevo = window.prompt('Nuevo nombre de la carpeta:', sub.label);
    if (!nuevo || !nuevo.trim() || nuevo.trim() === sub.label) return;
    const nuevoLimpio = nuevo.trim();
    const nuevoKey = nuevoLimpio.toLowerCase();
    if (nuevoKey !== sub.key && subsDe(catId).some(s => s.key === nuevoKey)) return toast.avisar('Ya existe una carpeta con ese nombre.', 'alerta');
    try {
      const { error: errStock } = await supabase.from('stock').update({ subcategoria: nuevoKey }).eq('categoria', catId).eq('subcategoria', sub.key);
      if (errStock) throw errStock;
      await supabase.from('subsubcategorias').update({ subcategoria: nuevoKey }).eq('categoria', catId).eq('subcategoria', sub.key);
      const fila = subcategoriasDB.find(s => String(s.categoria).toLowerCase() === catId && String(s.nombre).trim().toLowerCase() === sub.key);
      if (fila) {
        const { error: errSub } = await supabase.from('subcategorias').update({ nombre: nuevoLimpio }).eq('id', fila.id);
        if (errSub) throw errSub;
      } else { await supabase.from('subcategorias').insert([{ categoria: catId, nombre: nuevoLimpio }]); }
      await cargarSubcategorias();
      await cargarSubsubcategorias();
      setSubsLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.nombre).trim().toLowerCase() === sub.key)));
      setSubsubLocales(prev => prev.map(x => String(x.categoria).toLowerCase() === catId && String(x.subcategoria).toLowerCase() === sub.key ? { ...x, subcategoria: nuevoKey } : x));
      setStock((stock || []).map((it: any) => String(it.categoria).toLowerCase() === catId && String(it.subcategoria || '').toLowerCase().trim() === sub.key ? { ...it, subcategoria: nuevoKey } : it));
      setSel({ cat: catId, sub: nuevoKey, subsub: null });
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const eliminarSubcategoria = async (catId: string, sub: { key: string; label: string; count: number }) => {
    const aviso = sub.count > 0 ? `¿Eliminar la carpeta "${sub.label}"?\nLos ${sub.count} productos NO se borran.` : `¿Eliminar la carpeta vacía "${sub.label}"?`;
    if (!(await confirmar({ titulo: 'Eliminar carpeta', mensaje: aviso.replace(/\n+/g, ' '), textoOk: 'Sí, eliminar', peligro: true }))) return;
    try {
      let { error: errStock } = await supabase.from('stock').update({ subcategoria: null, subsubcategoria: null }).eq('categoria', catId).eq('subcategoria', sub.key);
      if (errStock && /column|schema cache/i.test(String(errStock.message || ''))) {
        ({ error: errStock } = await supabase.from('stock').update({ subcategoria: null }).eq('categoria', catId).eq('subcategoria', sub.key));
      }
      if (errStock) throw errStock;
      await supabase.from('subsubcategorias').delete().eq('categoria', catId).eq('subcategoria', sub.key);
      const fila = subcategoriasDB.find(s => String(s.categoria).toLowerCase() === catId && String(s.nombre).trim().toLowerCase() === sub.key);
      if (fila) await supabase.from('subcategorias').delete().eq('id', fila.id);
      await cargarSubcategorias();
      await cargarSubsubcategorias();
      setSubsLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.nombre).trim().toLowerCase() === sub.key)));
      setSubsubLocales(prev => prev.filter(x => !(String(x.categoria).toLowerCase() === catId && String(x.subcategoria).toLowerCase() === sub.key)));
      setStock((stock || []).map((it: any) => String(it.categoria).toLowerCase() === catId && String(it.subcategoria || '').toLowerCase().trim() === sub.key ? { ...it, subcategoria: null, subsubcategoria: null } : it));
      setSel({ cat: catId, sub: null, subsub: null });
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const iniciarArrastre = (e: React.DragEvent, item: any) => {
    const ids = seleccionados.includes(item.id) ? seleccionados : [item.id];
    e.dataTransfer.setData(MIME_STOCK, JSON.stringify({ tipo: 'productos', ids }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const moverProductos = async (ids: string[], catId: string, subKey: string | null, subsubKey: string | null = null) => {
    if (!ids || ids.length === 0) return;
    const cat = String(catId).toLowerCase();
    const cambios: any = { categoria: cat, subcategoria: subKey, subsubcategoria: subsubKey, ultima_actualizacion: new Date().toLocaleString() };
    try {
      for (let i = 0; i < ids.length; i += 200) {
        let { error } = await supabase.from('stock').update(cambios).in('id', ids.slice(i, i + 200));
        if (error && /column|schema cache/i.test(String(error.message || ''))) {
          const sinNivel3 = { ...cambios };
          delete sinNivel3.subsubcategoria;
          ({ error } = await supabase.from('stock').update(sinNivel3).in('id', ids.slice(i, i + 200)));
        }
        if (error) throw error;
      }
      const setIds = new Set(ids);
      setStock((stock || []).map((it: any) => setIds.has(it.id) ? { ...it, ...cambios } : it));
      setSeleccionados([]); setDestinoMover('');
      const labelSub = subKey ? (subsDe(cat).find(s => s.key === subKey)?.label || capitalizar(subKey)) : '';
      const labelSubSub = subsubKey ? (subsubsDe(cat, subKey || '').find(s => s.key === subsubKey)?.label || capitalizar(subsubKey)) : '';
      let destino = obtenerLabelCategoria(cat);
      if (subKey) destino += ` › ${labelSub}`;
      if (subsubKey) destino += ` › ${labelSubSub}`;
      setMensajeEstado(`✅ ${ids.length} productos movidos a ${destino}`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error('No se pudieron mover: ' + err.message); }
  };

  const eliminarSeleccionados = async () => {
    if (!(await confirmar({ titulo: `Eliminar ${seleccionados.length} producto(s)`, mensaje: 'Esta acción no se puede deshacer.', textoOk: 'Sí, eliminar', peligro: true }))) return;
    try {
      const { error } = await supabase.from('stock').delete().in('id', seleccionados);
      if (error) throw error;
      setStock((stock || []).filter((item: any) => !seleccionados.includes(item.id)));
      setSeleccionados([]);
      setMensajeEstado(`✅ ${seleccionados.length} productos eliminados definitivamente.`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error("Error al eliminar: " + err.message); }
  };

  const cambiarEstadoStockMasivo = async (estadoSinStock: boolean) => {
    try {
      for (let i = 0; i < seleccionados.length; i += 200) {
        const { error } = await supabase.from('stock').update({ sin_stock: estadoSinStock }).in('id', seleccionados.slice(i, i + 200));
        if (error) throw error;
      }
      setStock((stock || []).map((it: any) => seleccionados.includes(it.id) ? { ...it, sin_stock: estadoSinStock } : it));
      setSeleccionados([]);
      setMensajeEstado(`✅ Stock actualizado correctamente.`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error('Error al actualizar stock: ' + err.message); }
  };

  const moverCarpeta = async (catOrigen: string, subKey: string, catDestino: string) => {
    const origen = String(catOrigen).toLowerCase();
    const destino = String(catDestino).toLowerCase();
    if (!subKey || origen === destino) return;
    const existeDestino = subsDe(destino).some(s => s.key === subKey);
    if (existeDestino && !(await confirmar({ titulo: 'Combinar carpetas', mensaje: `¿Combinar productos en la carpeta "${capitalizar(subKey)}" existente en ${obtenerLabelCategoria(destino)}?`, textoOk: 'Combinar' }))) return;
    try {
      const { error } = await supabase.from('stock').update({ categoria: destino, ultima_actualizacion: new Date().toLocaleString() }).eq('categoria', origen).eq('subcategoria', subKey);
      if (error) throw error;
      await supabase.from('subsubcategorias').update({ categoria: destino }).eq('categoria', origen).eq('subcategoria', subKey);
      const filaOrigen = subcategoriasDB.find(s => String(s.categoria).toLowerCase() === origen && String(s.nombre).trim().toLowerCase() === subKey);
      if (filaOrigen) {
        if (existeDestino) await supabase.from('subcategorias').delete().eq('id', filaOrigen.id);
        else await supabase.from('subcategorias').update({ categoria: destino }).eq('id', filaOrigen.id);
      }
      await cargarSubcategorias();
      await cargarSubsubcategorias();
      setSubsLocales(prev => prev.map(x => String(x.categoria).toLowerCase() === origen && String(x.nombre).trim().toLowerCase() === subKey ? { ...x, categoria: destino } : x));
      setSubsubLocales(prev => prev.map(x => String(x.categoria).toLowerCase() === origen && String(x.subcategoria).toLowerCase() === subKey ? { ...x, categoria: destino } : x));
      setStock((stock || []).map((it: any) => String(it.categoria).toLowerCase() === origen && String(it.subcategoria || '').toLowerCase().trim() === subKey ? { ...it, categoria: destino } : it));
      setSel({ cat: destino, sub: subKey, subsub: null });
      setMensajeEstado(`✅ Carpeta "${capitalizar(subKey)}" movida`);
      setTimeout(() => setMensajeEstado(''), 4000);
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const categoriasOrdenadas = [
    ...principalesIds.map(id => categorias.find(c => String(c.id).toLowerCase() === id)).filter((c): c is any => Boolean(c)),
    ...categorias.filter(c => !principalesIds.includes(String(c.id).toLowerCase())).sort((a, b) => String(a.label).localeCompare(String(b.label)))
  ];

  // Se calcula acá (no antes) porque construirCatalogoCompleto usa categoriasOrdenadas.
  const previewCatalogoCompleto = construirCatalogoCompleto(opcionesCatalogo);
  // Cuántos productos hay ocultos en la web dentro del alcance del catálogo.
  const ocultosWebCatalogo = useMemo(
    () => (stock || []).filter((p: any) => (opcionesCatalogo.incluirSinStock || !p.sin_stock) && ocultaEfectivaEnWeb(p)).length,
    [stock, opcionesCatalogo.incluirSinStock, categorias, subcategoriasDB, subsubsDB]
  );
  const stockSinStock = useMemo(() => (stock || []).filter((p: any) => p.sin_stock).length, [stock]);

  const ejecutarMoverSeleccionados = () => {
    if (!destinoMover) return;
    const partes = destinoMover.split('|');
    const cat = partes[0];
    const sub = partes[1] || '';
    const subsub = partes[2] || '';
    moverProductos(seleccionados, cat, sub || null, subsub || null);
  };

  const term = busqueda.trim().toLowerCase();
  const stockBase = (stock || []).filter((item: any) => {
    if (term) {
      const enVariedades = Array.isArray(item.variedades) && item.variedades.some((v: Variedad) => v.nombre?.toLowerCase().includes(term) || v.codigo?.toLowerCase().includes(term));
      return item.nombre?.toLowerCase().includes(term) || item.codigo?.toLowerCase().includes(term) || enVariedades;
    }
    if (!sel.cat) return true;
    if (String(item.categoria || '').toLowerCase() !== sel.cat) return false;
    if (sel.sub === null) return true;
    const s = String(item.subcategoria || '').toLowerCase().trim();
    if (sel.sub === SIN_SUB) return !s;
    if (s !== sel.sub) return false;
    if (sel.subsub) {
      const ss = String(item.subsubcategoria || '').toLowerCase().trim();
      return ss === sel.subsub;
    }
    return true;
  });

  const cmpTexto = (a: any, b: any) => String(a || '').localeCompare(String(b || ''), 'es', { numeric: true, sensitivity: 'base' });
  const stockFiltrado = [...stockBase].sort((a: any, b: any) => {
    switch (orden) {
      case 'nombre_desc': return cmpTexto(b.nombre, a.nombre);
      case 'codigo': return cmpTexto(a.codigo, b.codigo) || cmpTexto(a.nombre, b.nombre);
      case 'reciente': return String(b.ultima_actualizacion || '').localeCompare(String(a.ultima_actualizacion || ''));
      case 'precio_asc': return (Number(a.precio_minorista) || 0) - (Number(b.precio_minorista) || 0) || cmpTexto(a.nombre, b.nombre);
      case 'precio_desc': return (Number(b.precio_minorista) || 0) - (Number(a.precio_minorista) || 0) || cmpTexto(a.nombre, b.nombre);
      default: return cmpTexto(a.nombre, b.nombre);
    }
  });

  const itemsPaginaActual = stockFiltrado.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);
  const totalPaginas = Math.ceil(stockFiltrado.length / itemsPorPagina);
  const cambiarPagina = (n: number) => { if (n >= 1 && n <= totalPaginas) setPaginaActual(n); };

  const todosVisiblesSeleccionados = itemsPaginaActual.length > 0 && itemsPaginaActual.every((item: any) => seleccionados.includes(item.id));
  const manejarSeleccionIndividual = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const seleccionarTodosLosVisibles = () => { const idsVisibles = itemsPaginaActual.map((i: any) => i.id); setSeleccionados(prev => prev.length === idsVisibles.length ? [] : idsVisibles); };

  const rutaActual = (() => {
    if (term) return `Resultados para "${busqueda.trim()}" en todo el stock`;
    if (!sel.cat) return 'Todo el stock';
    const base = obtenerLabelCategoria(sel.cat);
    if (sel.sub === null) return base;
    if (sel.sub === SIN_SUB) return `${base} › Sin subcategoría`;
    const s = subsDe(sel.cat).find(x => x.key === sel.sub);
    const baseSub = `${base} › ${s ? s.label : capitalizar(sel.sub)}`;
    if (!sel.subsub) return baseSub;
    const h = subsubsDe(sel.cat, sel.sub).find(x => x.key === sel.subsub);
    return `${baseSub} › ${h ? h.label : capitalizar(sel.subsub)}`;
  })();

  const panelStyle: React.CSSProperties = { width: isMobile ? '100%' : '290px', flexShrink: 0, padding: '14px 10px', borderRadius: '16px', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, backgroundColor: darkMode ? '#111c33' : '#ffffff', position: isMobile ? 'static' : 'sticky', top: '16px', maxHeight: isMobile ? 'none' : 'calc(100vh - 32px)', overflowY: 'auto' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', width: '100%' }}>
      {productoSeleccionado && <ModalDetalle item={productoSeleccionado} darkMode={darkMode} onClose={() => setProductoSeleccionado(null)} onEdit={activarEdicion} onDelete={borrarItem} obtenerLabelCategoria={obtenerLabelCategoria} onCodigoChange={actualizarCodigoProducto} />}
      {mostrarModalCategorias && <ModalCategorias categorias={categorias} darkMode={darkMode} onClose={() => setMostrarModalCategorias(false)} crearCategoria={crearCategoria} actualizarCategoria={actualizarCategoria} eliminarCategoria={eliminarCategoria} />}

      <ModalImportarExcel isOpen={mostrarModalImportar} onClose={() => setMostrarModalImportar(false)} categorias={categorias} stock={stock} setStock={setStock} darkMode={darkMode} setSel={setSel} />

      {modalCategoria !== undefined && (
        <ModalCategoria
          categoria={modalCategoria}
          darkMode={darkMode}
          subiendo={guardandoCategoria}
          onClose={() => setModalCategoria(undefined)}
          onGuardar={(datos) => guardarCategoria({ ...datos, archivo: (datos as any).archivo })}
        />
      )}

      <ActualizarPrecios isOpen={mostrarModalActualizarPrecios} onClose={() => setMostrarModalActualizarPrecios(false)} categorias={categorias} subcategorias={subcategoriasDB} stock={stock} setStock={setStock} darkMode={darkMode} />

      {/* El título de la sección ya está en la barra superior: acá va el contexto útil */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: theme.subtext }}>
            <strong style={{ color: theme.text }}>{stock?.length || 0}</strong> productos cargados
          </span>
          {stockSinStock > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
              fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)'
            }}>
              🚫 {stockSinStock} sin stock
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {isMobile && <button onClick={() => setPanelAbierto(v => !v)} aria-label="Ver carpetas" style={{ ...btnBaseStyle, width: 'auto', backgroundColor: '#334155', padding: '12px 14px', flexShrink: 0 }}>📁</button>}
        <input
          type="text"
          placeholder="Buscar por nombre, código o variedad..."
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPaginaActual(1); }}
          style={{ ...inputStyle, borderRadius: '999px', paddingLeft: '22px' }}
        />
      </div>

      {/* En celular las acciones se agrupan en una grilla de dos columnas:
          antes cada botón ocupaba una fila y tapaban la lista. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(190px, auto))',
        gap: '10px',
        justifyContent: isMobile ? 'stretch' : 'start'
      }}>
        <button onClick={abrirFormularioNuevo} style={{ ...btnBaseStyle, background: 'linear-gradient(180deg,#3b82f6 0%,#2563eb 100%)' }}>➕ Agregar producto</button>
        <button onClick={() => setMostrarModalImportar(true)} style={{ ...btnBaseStyle, background: 'linear-gradient(180deg,#10b981 0%,#059669 100%)' }}>📥 Importar Excel</button>
        <button onClick={() => setMostrarModalActualizarPrecios(true)} style={{ ...btnBaseStyle, background: 'linear-gradient(180deg,#f59e0b 0%,#d97706 100%)' }}>💰 Actualizar Precios</button>
        <MenuBotonCategorias
          darkMode={darkMode}
          btnBaseStyle={btnMenuStyle}
          menuStyle={menuStyleMovil}
          label="Imprimir códigos de barra"
          icono="🖨️"
          colorBoton="#7c3aed"
          categorias={categoriasOrdenadas}
          principalesIds={principalesIds}
          mostrarSubs={true}
          subsDe={subsDe}
          subsubsDe={subsubsDe}
          conteos={conteos}
          extra={seleccionados.length > 0 ? {
            label: `✅ Selección actual (${seleccionados.length} productos)`,
            onClick: imprimirEtiquetasSeleccionados
          } : null}
          onElegir={imprimirEtiquetasDeRuta}
        />
        <MenuBotonCategorias
          darkMode={darkMode}
          btnBaseStyle={btnMenuStyle}
          menuStyle={menuStyleMovil}
          label="Catálogo Mayorista"
          icono="📄"
          colorBoton="#ef4444"
          categorias={categoriasOrdenadas}
          principalesIds={principalesIds}
          mostrarSubs={true}
          subsDe={subsDe}
          subsubsDe={subsubsDe}
          conteos={conteos}
          accionCarpeta="Generar el catálogo de"
          accionRuta="Generar el catálogo de"
          onElegir={({ cat, sub, subsub }) => generarPDFCatalogo(cat, sub, subsub ?? null)}
        />
        <MenuCatalogoCompleto
          darkMode={darkMode}
          btnBaseStyle={btnMenuStyle}
          menuStyle={menuStyleMovil}
          totalProductos={totalFilasCatalogo(previewCatalogoCompleto)}
          ocultosWeb={ocultosWebCatalogo}
          opciones={opcionesCatalogo}
          setOpciones={setOpcionesCatalogo}
          generandoPdf={generandoCatalogo === 'pdf'}
          generandoExcel={generandoCatalogo === 'excel'}
          onPdf={() => generarPDFCatalogoCompleto(opcionesCatalogo)}
          onExcel={() => generarExcelCatalogoCompleto(opcionesCatalogo)}
        />
      </div>

      {mensajeEstado && <div style={{ padding: '12px 20px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '14.5px', fontWeight: '700', border: '1px solid #10b981', display: 'inline-block' }}>{mensajeEstado}</div>}

      {mostrarModalFormulario && (
        <ModalGenerico titulo={editando ? '✏️ Editar producto' : '➕ Agregar producto'} darkMode={darkMode} onClose={resetForm} maxWidth="640px">
          <FormularioProducto form={form} setForm={setForm} editando={editando} resetForm={resetForm} guardar={guardar} subiendoImagen={subiendoImagen} imagenArchivo={imagenArchivo} setImagenArchivo={setImagenArchivo} fileInputRef={fileInputRef} isMobile={isMobile} theme={theme} inputStyle={inputStyle} btnBaseStyle={btnBaseStyle} CATEGORIAS={categorias} />
          <VariedadesEditor variedades={form.variedades} onChange={(nuevas: Variedad[]) => setForm(f => ({ ...f, variedades: nuevas }))} darkMode={darkMode} subirImagen={subirImagen} />
        </ModalGenerico>
      )}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', width: '100%' }}>
        {(!isMobile || panelAbierto) && (
          <aside style={panelStyle}>
            <PanelCarpetas darkMode={darkMode} categorias={categorias} sel={sel} seleccionar={seleccionar} conteos={conteos} totalStock={stock?.length || 0} subsDe={subsDe} subsubsDe={subsubsDe} onCrearSub={crearSubcategoria} onCrearSubSub={crearSubsubcategoria} onRenombrarSub={renombrarSubcategoria} onEliminarSub={eliminarSubcategoria} onRenombrarSubSub={renombrarSubsubcategoria} onEliminarSubSub={eliminarSubsubcategoria} onDropProductos={moverProductos} onDropCarpeta={moverCarpeta} onGestionar={() => setMostrarModalCategorias(true)} onRenombrarCategoria={renombrarCategoria} onEliminarCategoria={eliminarCategoriaConHijos} principalesIds={principalesIds} onEditarCategoria={abrirEdicionCategoria} onNuevaPrincipal={abrirNuevaPrincipal} onAlternarCategoria={alternarVisibilidadCategoria} onAlternarSub={alternarVisibilidadSub} onAlternarSubSub={alternarVisibilidadSubSub} />
          </aside>
        )}

        <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: theme.text }}>📂 {rutaActual}</h2>
            {/* flexWrap: sin esto, en celulares el <select> de orden (247px de
                ancho por las opciones) desborda el documento 35px. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: '0.85rem', color: theme.subtext }}>Mostrando {stockFiltrado.length} resultados</span>
              <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}` }}>
                <button onClick={() => setVista('grilla')} title="Vista tarjetas" style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'grilla' ? '#3b82f6' : 'transparent', color: vista === 'grilla' ? 'white' : theme.subtext }}>▦</button>
                <button onClick={() => setVista('tabla')} title="Vista tabla" style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', backgroundColor: vista === 'tabla' ? '#3b82f6' : 'transparent', color: vista === 'tabla' ? 'white' : theme.subtext }}>☰</button>
              </div>
              <select value={orden} onChange={e => { setOrden(e.target.value as any); setPaginaActual(1); }} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px' }}>
                <option value="nombre_asc">Ordenar: Nombre A-Z</option>
                <option value="nombre_desc">Nombre Z-A</option>
                <option value="codigo">Código</option>
                <option value="reciente">Últimos actualizados</option>
                <option value="precio_asc">Precio minorista: menor a mayor</option>
                <option value="precio_desc">Precio minorista: mayor a menor</option>
              </select>
            </div>
          </div>

          <details style={{ marginBottom: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: darkMode ? '#3b82f6' : '#2563eb', marginBottom: '12px' }}>⚙️ Herramientas masivas</summary>
            <ModificadoresMasivos darkMode={darkMode} isMobile={isMobile} theme={theme} inputStyle={inputStyle} btnBaseStyle={btnBaseStyle} CATEGORIAS={categorias} catAumentar={catAumentar} setCatAumentar={setCatAumentar} columnaAumentar={columnaAumentar} setColumnaAumentar={setColumnaAumentar} COLUMNAS_PRECIO={COLUMNAS_PRECIO} porcentajeAumento={porcentajeAumento} setPorcentajeAumento={setPorcentajeAumento} actualizandoGlobal={actualizandoGlobal} ejecutarAumentoGlobal={() => {}} nuevaCategoriaMasiva={nuevaCategoriaMasiva} setNuevaCategoriaMasiva={setNuevaCategoriaMasiva} seleccionados={seleccionados} actualizandoCategoriaMasiva={actualizandoCategoriaMasiva} ejecutarModificacionCategoriaMasiva={() => {}} onAbrirGestionCategorias={() => setMostrarModalCategorias(true)} />
          </details>

          {stockFiltrado.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '14px', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${seleccionados.length > 0 ? '#3b82f6' : (darkMode ? '#334155' : '#e2e8f0')}`, backgroundColor: seleccionados.length > 0 ? (darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)') : 'transparent' }}>
              <button onClick={seleccionarTodosLosVisibles} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, background: 'transparent', color: theme.text, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                {todosVisiblesSeleccionados ? '☑ Quitar selección' : '☐ Seleccionar todos'}
              </button>
              
              {seleccionados.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginLeft: '4px' }}>
                  <strong style={{ color: theme.text, fontSize: '0.88rem', marginRight: '6px' }}>{seleccionados.length} seleccionados</strong>
                  
                  <select value={destinoMover} onChange={e => setDestinoMover(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '130px', padding: '8px 12px', fontSize: '12px' }}>
                    <option value="">📁 Mover a…</option>
                    {categoriasOrdenadas.map((c: any) => {
                      const cid = String(c.id).toLowerCase();
                      return (
                        <optgroup key={cid} label={c.label}>
                          <option value={`${cid}|`}>{c.label} (sin subcategoría)</option>
                          {subsDe(cid).map(s => (
                            <React.Fragment key={s.key}>
                              <option value={`${cid}|${s.key}`}>↳ {s.label}</option>
                              {subsubsDe(cid, s.key).map(h => <option key={h.key} value={`${cid}|${s.key}|${h.key}`}>↳↳ {h.label}</option>)}
                            </React.Fragment>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <button onClick={ejecutarMoverSeleccionados} disabled={!destinoMover} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: destinoMover ? '#3b82f6' : '#64748b', color: 'white', fontWeight: 700, cursor: destinoMover ? 'pointer' : 'not-allowed', fontSize: '0.82rem' }}>Mover</button>

                  <div style={{ width: '1px', height: '24px', background: darkMode ? '#334155' : '#cbd5e1', margin: '0 4px' }} />
                  
                  <button onClick={() => cambiarEstadoStockMasivo(true)} title="Pausar y marcar como agotado" style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>🚫 Agotado</button>
                  <button onClick={() => cambiarEstadoStockMasivo(false)} title="Restaurar y mostrar en stock" style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>✅ En Stock</button>
                  <button onClick={eliminarSeleccionados} title="Eliminar del sistema" style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>🗑️ Borrar</button>

                  <button onClick={() => setSeleccionados([])} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: theme.subtext, cursor: 'pointer', fontSize: '0.82rem' }}>✕ Limpiar</button>
                </div>
              )}
            </div>
          )}

          {stockFiltrado.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: theme.subtext, border: `1px dashed ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '16px' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>📭</div>
              <div style={{ fontWeight: 700, color: theme.text, marginBottom: '4px' }}>Esta carpeta está vacía</div>
              <div style={{ fontSize: '0.88rem' }}>Usá "Agregar producto" para cargar el primero aquí.</div>
            </div>
          ) : vista === 'grilla' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? '10px' : '18px' }}>
              {itemsPaginaActual.map((item: any) => <ProductoCard key={item.id} item={item} darkMode={darkMode} seleccionado={seleccionados.includes(item.id)} onToggle={manejarSeleccionIndividual} onOpen={() => setProductoSeleccionado(item)} onDragStart={iniciarArrastre} onEdit={activarEdicion} onDelete={borrarItem} onToggleVisibilidad={alternarVisibilidadProducto} />)}
            </div>
          ) : (
            <TablaStock isMobile={isMobile} itemsPaginaActual={itemsPaginaActual} seleccionados={seleccionados} manejarSeleccionIndividual={manejarSeleccionIndividual} setProductoSeleccionado={setProductoSeleccionado} obtenerLabelCategoria={obtenerLabelCategoria} activarEdicion={activarEdicion} borrarItem={borrarItem} actionBtnStyle={actionBtnStyle} darkMode={darkMode} theme={theme} onAlternarVisibilidad={alternarVisibilidadProducto} />
          )}

          {totalPaginas > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => cambiarPagina(paginaActual - 1)} disabled={paginaActual === 1} style={actionBtnStyle('#3b82f6')}>← Anterior</button>
              <span style={{ color: theme.subtext, fontSize: '0.9rem' }}>Página {paginaActual} de {totalPaginas}</span>
              <button onClick={() => cambiarPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas} style={actionBtnStyle('#3b82f6')}>Siguiente →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}