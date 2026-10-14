"use client";
// =============================================================================
// Registro central de iconos
// -----------------------------------------------------------------------------
// Reemplaza los emojis sueltos por un set coherente. Ningún componente importa
// librerías de iconos directo: siempre pasa por acá.
// =============================================================================
import type { ReactNode } from 'react';
import {
  HiOutlineHome, HiOutlineShoppingCart, HiOutlineBuildingStorefront, HiOutlineCube,
  HiOutlineCreditCard, HiOutlineChartBar, HiOutlinePhoto, HiOutlineUsers, HiOutlineGlobeAlt,
  HiOutlineSparkles, HiOutlineMagnifyingGlass, HiOutlinePlus, HiOutlineArrowDownTray,
  HiOutlineCurrencyDollar, HiOutlineArrowPath, HiOutlineBars3, HiOutlinePaperAirplane,
  HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineChevronLeft, HiOutlineXMark,
  HiOutlineCheck, HiOutlineExclamationTriangle, HiOutlineInformationCircle,
  HiOutlineQrCode, HiOutlineTag, HiOutlineFolder, HiOutlineFunnel, HiOutlineArrowsUpDown,
  HiOutlineCalendarDays, HiOutlineClock, HiOutlineSun, HiOutlineMoon, HiOutlineArrowLeft,
  HiOutlineBolt, HiOutlineDocumentText, HiOutlineChartPie, HiOutlineWifi
} from 'react-icons/hi2';

type Props = { size?: number; className?: string };

const conTamano = (Icon: (p: any) => ReactNode) =>
  function Ico({ size = 18, className }: Props) {
    return <Icon style={{ fontSize: size, flexShrink: 0 }} className={className} />;
  };

export const Icono = {
  Inicio: conTamano(HiOutlineHome),
  Venta: conTamano(HiOutlineShoppingCart),
  Mayorista: conTamano(HiOutlineBuildingStorefront),
  Pedidos: conTamano(HiOutlineCube),
  Inventario: conTamano(HiOutlineCube),
  CuentaCorriente: conTamano(HiOutlineCreditCard),
  Caja: conTamano(HiOutlineChartBar),
  Portada: conTamano(HiOutlinePhoto),
  Usuarios: conTamano(HiOutlineUsers),
  Web: conTamano(HiOutlineGlobeAlt),
  Ofertas: conTamano(HiOutlineSparkles),
  Buscar: conTamano(HiOutlineMagnifyingGlass),
  Agregar: conTamano(HiOutlinePlus),
  Descargar: conTamano(HiOutlineArrowDownTray),
  Precio: conTamano(HiOutlineCurrencyDollar),
  Refrescar: conTamano(HiOutlineArrowPath),
  Menu: conTamano(HiOutlineBars3),
  Enviar: conTamano(HiOutlinePaperAirplane),
  ChevronDown: conTamano(HiOutlineChevronDown),
  ChevronRight: conTamano(HiOutlineChevronRight),
  ChevronLeft: conTamano(HiOutlineChevronLeft),
  Cerrar: conTamano(HiOutlineXMark),
  Confirmar: conTamano(HiOutlineCheck),
  Alerta: conTamano(HiOutlineExclamationTriangle),
  Info: conTamano(HiOutlineInformationCircle),
  CodigoBarras: conTamano(HiOutlineQrCode),
  Etiqueta: conTamano(HiOutlineTag),
  Carpeta: conTamano(HiOutlineFolder),
  Filtro: conTamano(HiOutlineFunnel),
  Orden: conTamano(HiOutlineArrowsUpDown),
  Calendario: conTamano(HiOutlineCalendarDays),
  Reloj: conTamano(HiOutlineClock),
  Sol: conTamano(HiOutlineSun),
  Luna: conTamano(HiOutlineMoon),
  Volver: conTamano(HiOutlineArrowLeft),
  Rapido: conTamano(HiOutlineBolt),
  Documento: conTamano(HiOutlineDocumentText),
  Grafico: conTamano(HiOutlineChartPie),
  Online: conTamano(HiOutlineWifi)
} as const;

export type NombreIcono = keyof typeof Icono;

/** Emoji original → icono. Permite migrar pantalla por pantalla sin cambiar textos. */
export const ICONOS_POR_EMOJI: Record<string, NombreIcono> = {
  '🏠': 'Inicio',
  '💰': 'Venta',
  '📦': 'Mayorista',
  '🛒': 'Pedidos',
  '🧸': 'Inventario',
  '💳': 'CuentaCorriente',
  '📊': 'Caja',
  '🖼️': 'Portada',
  '👥': 'Usuarios',
  '🌐': 'Web',
  '🔎': 'Buscar',
  '➕': 'Agregar',
  '📥': 'Descargar',
  '📄': 'Documento',
  '🖨️': 'Documento',
  '☀️': 'Sol',
  '🌙': 'Luna',
  '⚠️': 'Alerta',
  '✅': 'Confirmar'
};