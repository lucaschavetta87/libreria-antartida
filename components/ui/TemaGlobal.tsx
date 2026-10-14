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
  /** true recién después de montar en el cliente: permite evitar saltos de hidratación. */
  montado: boolean;
};

const Contexto = createContext<ContextoTema | null>(null);

export const useTema = (): ContextoTema => {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaGlobal>');
  return ctx;
};

// El tema arranca siempre en oscuro para que el HTML del servidor y el primer
// render del cliente coincidan (si no, React avisa de hidratación). La
// preferencia real se aplica apenas monta: el script de app/layout.tsx ya
// puso el tema correcto en el DOM, así que no hay parpadeo.
const _temaInicial = true;

export default function TemaGlobal({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(_temaInicial);
  const [esMovil, setEsMovil] = useState(false);
  const [ancho, setAncho] = useState(1280);
  const [montado, setMontado] = useState(false);

  // Aplica el tema al DOM y lo persiste.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { window.localStorage.setItem('tema', darkMode ? 'oscuro' : 'claro'); } catch { /* modo privado */ }
  }, [darkMode]);

  // Primera vez: se adopta la preferencia guardada (sin parpadeo visible).
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem('tema');
      if (guardado === 'oscuro') setDarkMode(true);
      else if (guardado === 'claro') setDarkMode(false);
    } catch { /* modo privado */ }
  }, []);

  // Un solo listener de resize para toda la app (antes estaba duplicado en 4 archivos).
  useEffect(() => {
    const medir = () => {
      const w = window.innerWidth;
      setAncho(w);
      setEsMovil(w <= 768);
    };
    setMontado(true);
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
    ancho,
    montado
  }), [darkMode, esMovil, ancho, montado]);

  return (
    <Contexto.Provider value={valor}>
      <ProveedorAvisos darkMode={darkMode}>{children}</ProveedorAvisos>
    </Contexto.Provider>
  );
}