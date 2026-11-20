import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  output: 'standalone',

  // Fijamos la raiz del workspace en esta carpeta.
  //
  // Sin esto, Next detecta varios package-lock.json (el repositorio de git esta
  // en /home/lucas, un nivel por encima) y elige /home/lucas como raiz. Entonces
  // el dev server termina escaneando toda la carpeta home y se cuelga consumiendo
  // CPU sin llegar a compilar la pagina.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;