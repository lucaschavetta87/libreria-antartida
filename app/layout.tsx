const SCRIPT_TEMA = `(function(){try{var g=localStorage.getItem('tema');var t=g==='claro'?'light':(g==='oscuro'?'dark':(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme se setea en el servidor y lo ajusta este script antes de
    // pintar: evita el parpadeo de tema al recargar (antes el tema quedaba
    // forzado a oscuro por CSS).
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}