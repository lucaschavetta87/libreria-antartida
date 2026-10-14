# Sistema de Gestion - Pueblos de la India

Aplicacion interna para administrar stock, ventas, clientes, caja y la portada de la
pagina web publica.

## Puesta en marcha

```bash
npm install
npm run dev
```

Abrir http://localhost:3000

### Variables de entorno (opcional)

El proyecto **funciona sin configurar nada**: las credenciales de Supabase tienen un
valor por defecto en `lib/supabase.ts`.

Si preferís configurarlas por variables de entorno:

```bash
cp .env.example .env.local
```

`.env.local` esta en `.gitignore` a proposito: no se sube al repositorio.
`.env.example` si se sube, para que quede documentado que variables hacen falta.

## Base de datos

El proyecto usa Supabase. La tabla `portada_web` y el bucket `portada-imagenes`
se crean ejecutando, **una sola vez**, en el editor SQL de Supabase:

```
scripts/portada_web.sql
```

Sin ese script el sistema de gestion sigue funcionando, pero la seccion
"Control Portada" no puede guardar cambios.

## Estructura

- `app/page.tsx` — punto de entrada, login y navegacion entre secciones
- `components/` — cada seccion del menu es un componente
- `lib/supabase.ts` — cliente unico de Supabase
- `lib/imageUtils.ts` — redimensionado y compresion de imagenes antes de subirlas
- `scripts/` — SQL y utilidades de mantenimiento

## Secciones

Inicio, Venta Minorista, Venta Mayorista, Pedidos Web, Productos, Cuenta Corriente,
Cierre de Caja, Gestion Usuarios, Pagina Web y Control Portada.

Los permisos por usuario se administran desde **Gestion Usuarios**. Cada seccion
tiene un permiso asignado; el usuario `admin` los tiene todos.