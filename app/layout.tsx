// globals.css nunca había sido importado en el proyecto: sin esto no se aplican
// las variables de tema, las utilidades responsive ni el css de impresión.
import './globals.css';
import TemaGlobal from '../components/ui/TemaGlobal';

// El sistema arranca siempre en modo claro: el tema se aplica antes de pintar
// para que no haya parpadeo ni destello al cargar.
const SCRIPT_TEMA = `document.documentElement.setAttribute('data-theme','light');`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme lo fija este script antes de pintar: evita el parpadeo de tema
    // al cargar (antes el tema quedaba forzado a oscuro por CSS).
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <TemaGlobal>{children}</TemaGlobal>
      </body>
    </html>
  );
}