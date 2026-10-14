"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icono } from '../Icons';

// =============================================================================
// Avisos y confirmaciones
// -----------------------------------------------------------------------------
// Reemplaza los alert()/window.confirm() dispersos por notificaciones no
// bloqueantes y un diálogo de confirmación con el estilo del sistema.
// La lógica de los flujos NO cambia: el diálogo devuelve true/false igual que
// un confirm, solo se ve mejor y no congela la pantalla.
// =============================================================================

type TipoToast = 'exito' | 'error' | 'info' | 'alerta';

type Toast = { id: number; texto: string; tipo: TipoToast };

type PedidoConfirm = {
  titulo: string;
  mensaje: string;
  textoOk?: string;
  textoCancelar?: string;
  peligro?: boolean;
  resolver: (valor: boolean) => void;
};

type ContextoAvisos = {
  avisar: (texto: string, tipo?: TipoToast, duracionMs?: number) => void;
  exito: (texto: string, duracionMs?: number) => void;
  error: (texto: string, duracionMs?: number) => void;
  confirmar: (pedido: Omit<PedidoConfirm, 'resolver'>) => Promise<boolean>;
};

const Contexto = createContext<ContextoAvisos | null>(null);

export const useToast = (): ContextoAvisos => {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ProveedorAvisos>');
  return ctx;
};

const COLOR_POR_TIPO: Record<TipoToast, { fondo: string; borde: string; texto: string; icono: 'Confirmar' | 'Alerta' | 'Info' | 'Cerrar' }> = {
  exito: { fondo: 'rgba(16,185,129,0.14)', borde: '#10b981', texto: '#059669', icono: 'Confirmar' },
  error: { fondo: 'rgba(239,68,68,0.14)', borde: '#ef4444', texto: '#dc2626', icono: 'Alerta' },
  alerta: { fondo: 'rgba(245,158,11,0.14)', borde: '#f59e0b', texto: '#b45309', icono: 'Alerta' },
  info: { fondo: 'rgba(59,130,246,0.14)', borde: '#3b82f6', texto: '#2563eb', icono: 'Info' }
};

export function ProveedorAvisos({ children, darkMode = true }: { children: React.ReactNode; darkMode?: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmPendiente, setConfirmPendiente] = useState<PedidoConfirm | null>(null);
  const contador = useRef(0);

  const avisar = useCallback((texto: string, tipo: TipoToast = 'info', duracionMs = 4200) => {
    const id = ++contador.current;
    setToasts((prev) => [...prev, { id, texto, tipo }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duracionMs);
  }, []);

  const confirmar = useCallback((pedido: Omit<PedidoConfirm, 'resolver'>) => {
    return new Promise<boolean>((resolver) => setConfirmPendiente({ ...pedido, resolver }));
  }, []);

  const responder = (valor: boolean) => {
    confirmPendiente?.resolver(valor);
    setConfirmPendiente(null);
  };

  const valor = useMemo<ContextoAvisos>(() => ({
    avisar,
    exito: (texto: string, duracionMs?: number) => avisar(texto, 'exito', duracionMs),
    error: (texto: string, duracionMs?: number) => avisar(texto, 'error', duracionMs),
    confirmar
  }), [avisar, confirmar]);

  const esOscuro = darkMode;

  return (
    <Contexto.Provider value={valor}>
      {children}

      {/* Notificaciones */}
      <div
        aria-live="polite"
        className="no-imprimir"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          left: 'auto',
          zIndex: 1400,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '10px',
          maxWidth: 'min(380px, calc(100vw - 32px))',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((t) => {
          const c = COLOR_POR_TIPO[t.tipo];
          const I = Icono[c.icono];
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '13px 14px',
                borderRadius: 14,
                background: esOscuro ? '#1e293b' : '#ffffff',
                border: `1px solid ${c.borde}`,
                boxShadow: '0 18px 40px -18px rgba(0,0,0,0.6)',
                animation: 'toastEntra 0.18s ease-out'
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: c.fondo, color: c.texto,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <I size={16} />
              </span>
              <span style={{ fontSize: '0.88rem', lineHeight: 1.35, color: esOscuro ? '#f8fafc' : '#0f172a', paddingTop: 4 }}>
                {t.texto}
              </span>
            </div>
          );
        })}
      </div>

      {/* Confirmación */}
      {confirmPendiente && (
        <div
          onClick={() => responder(false)}
          className="no-imprimir"
          style={{
            position: 'fixed', inset: 0, zIndex: 1500,
            background: esOscuro ? 'rgba(2,6,23,0.75)' : 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%', maxWidth: 420,
              background: esOscuro ? '#1e293b' : '#ffffff',
              border: `1px solid ${esOscuro ? '#334155' : '#e2e8f0'}`,
              borderRadius: 18,
              padding: 22,
              boxShadow: '0 30px 70px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              <span style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: confirmPendiente.peligro ? 'rgba(239,68,68,0.14)' : 'rgba(79,70,229,0.12)',
                color: confirmPendiente.peligro ? '#dc2626' : '#4f46e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {confirmPendiente.peligro ? <Icono.Alerta size={20} /> : <Icono.Info size={20} />}
              </span>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: '2px 0 6px', fontSize: '1rem', fontWeight: 800, color: esOscuro ? '#f8fafc' : '#0f172a' }}>
                  {confirmPendiente.titulo}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.45, color: esOscuro ? '#94a3b8' : '#475569' }}>
                  {confirmPendiente.mensaje}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
              <button
                onClick={() => responder(false)}
                style={{
                  padding: '11px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                  border: `1px solid ${esOscuro ? '#334155' : '#cbd5e1'}`,
                  background: 'transparent', color: esOscuro ? '#f8fafc' : '#0f172a', minHeight: 42
                }}
              >
                {confirmPendiente.textoCancelar || 'Cancelar'}
              </button>
              <button
                onClick={() => responder(true)}
                autoFocus
                style={{
                  padding: '11px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                  border: 'none', color: '#fff', minHeight: 42,
                  background: confirmPendiente.peligro ? 'linear-gradient(180deg,#ef4444 0%,#dc2626 100%)' : 'linear-gradient(180deg,#4f46e5 0%,#4338ca 100%)'
                }}
              >
                {confirmPendiente.textoOk || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}