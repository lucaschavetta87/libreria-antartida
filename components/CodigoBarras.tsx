"use client";
import React from 'react';
import { barcodeSvg } from '../lib/codigobarras';

export default function CodigoBarras({
  codigo, width = 260, height = 64, color = '#000000', fondo = '#ffffff', style
}: { codigo: string; width?: number; height?: number; color?: string; fondo?: string; style?: React.CSSProperties }) {
  const svg = barcodeSvg(codigo, width, height, color, fondo);
  if (!svg) return null;
  return (
    <div
      style={{ display: 'inline-block', lineHeight: 0, borderRadius: '8px', overflow: 'hidden', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
