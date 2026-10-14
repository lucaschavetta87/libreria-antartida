"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { crearTema, type Tema } from '../../lib/theme';
import { ProveedorAvisos } from './Avisos';

// =============================================================================
// Proveedor raíz: tema (claro/oscuro) + avisos
// -----------------------------------------------------------------------------
// Vive por encima de toda la app (lo monta app/layout.tsx) para que CUALQUIER
// pantalla pueda leer el tema y lanzar avisos sin importar dónde esté en el árbol.
// =============================================================================

type ContextoTema = {
  darkMode: boolean;
  setDarkMode: (valor: boolean) => void;
  alternarTema: () => void;
  theme: Tema;
  esMovil: boolean;
  setEsMovil: (valor: boolean) => void;
  ancho: number;
};

const Contexto = createContext<ContextoTema | null>(null);

export const useTema = (): ContextoTema => {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaGlobal>');
  return ctx;
};

const leerTemaGuardado = (): boolean => {
  if (typeof window === 'undefined') return true;
  const guardado = window.localStorage.getItem('tema');
  if (guardado === 'oscuro') return true;
  if (guardado === 'claro') return false;
  return true;
};

export default function TemaGlobal({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(leerTemaGuardado);
  const [esMovil, setEsMovil] = useState(false);
  const [ancho, setAncho] = useState(1280);

  // Aplica el tema al DOM y lo persiste.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { window.localStorage.setItem('tema', darkMode ? 'oscuro' : 'claro'); } catch { /* modo privado */ }
  }, [darkMode]);

  // Un solo listener de resize para toda la app (antes estaba duplicado en 4 archivos).
  useEffect(() => {
    const medir = () => {
      const w = window.innerWidth;
      setAncho(w);
      setEsMovil(w <= 768);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const valor = useMemo<ContextoTema>(() => ({
    darkMode,
    setDarkMode,
    alternarTema: () => setDarkMode((v) => !v),
    theme: crearTema(darkMode),
    esMovil,
    setEsMovil,
    ancho
  }), [darkMode, esMovil, ancho]);

  return (
    <Contexto.Provider value={valor}>
      <ProveedorAvisos darkMode={darkMode}>{children}</ProveedorAvisos>
    </Contexto.Provider>
  );
}