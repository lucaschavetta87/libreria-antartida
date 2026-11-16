// Cliente para la API de MercadoLibre.
// Usa las variables de entorno ML_APP_ID, ML_SECRET_KEY, ML_REDIRECT_URI.
// Si no estan configuradas, las funciones devuelven null y la UI muestra
// un mensaje de "configurar credenciales".

const ML_API = 'https://api.mercadolibre.com';
const ML_AUTH = 'https://auth.mercadolibre.com.ar';

export const mlConfigurado = () => {
  return !!(process.env.NEXT_PUBLIC_ML_APP_ID && process.env.NEXT_PUBLIC_ML_SECRET_KEY);
};

export const mlAppId = () => process.env.NEXT_PUBLIC_ML_APP_ID || '';
export const mlSecretKey = () => process.env.NEXT_PUBLIC_ML_SECRET_KEY || '';
export const mlRedirectUri = () => process.env.NEXT_PUBLIC_ML_REDIRECT_URI || '';

// URL de autorizacion OAuth 2.0
export const urlAutorizacionML = () => {
  const appId = mlAppId();
  const redirect = mlRedirectUri();
  if (!appId || !redirect) return null;
  return `${ML_AUTH}/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}`;
};

// Intercambiar code por tokens
export async function intercambiarCodePorToken(code: string) {
  const appId = mlAppId();
  const secret = mlSecretKey();
  const redirect = mlRedirectUri();
  if (!appId || !secret || !redirect) return null;

  try {
    const res = await fetch(`${ML_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: secret,
        code: code,
        redirect_uri: redirect
      }).toString()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Refrescar token
export async function refrescarToken(refreshToken: string) {
  const appId = mlAppId();
  const secret = mlSecretKey();
  if (!appId || !secret) return null;

  try {
    const res = await fetch(`${ML_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: secret,
        refresh_token: refreshToken
      }).toString()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Llamada autenticada a la API de ML
export async function llamarAPIML(accessToken: string, endpoint: string, method: string = 'GET', body?: any) {
  try {
    const res = await fetch(`${ML_API}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      return { error: err, status: res.status };
    }
    return await res.json();
  } catch (e: any) {
    return { error: e.message };
  }
}

// Obtener datos del usuario ML
export async function obtenerUsuarioML(accessToken: string) {
  return llamarAPIML(accessToken, '/users/me');
}

// Listar publicaciones del vendedor
export async function listarPublicacionesML(accessToken: string, userId: number, status?: string) {
  let url = `/users/${userId}/items/search`;
  if (status) url += `?status=${status}`;
  return llamarAPIML(accessToken, url);
}

// Detalle de una publicacion
export async function detallePublicacionML(accessToken: string, itemId: string) {
  return llamarAPIML(accessToken, `/items/${itemId}`);
}

// Editar publicacion
export async function editarPublicacionML(accessToken: string, itemId: string, cambios: any) {
  return llamarAPIML(accessToken, `/items/${itemId}`, 'PUT', cambios);
}

// Listar ordenes (ventas) del vendedor
export async function listarOrdenesML(accessToken: string, userId: number, status?: string) {
  let url = `/orders/search?seller=${userId}&sort=date_desc`;
  if (status) url += `&order.status=${status}`;
  return llamarAPIML(accessToken, url);
}

// Detalle de una orden
export async function detalleOrdenML(accessToken: string, orderId: number) {
  return llamarAPIML(accessToken, `/orders/${orderId}`);
}

// Detalle de envio
export async function detalleEnvioML(accessToken: string, shipmentId: number) {
  return llamarAPIML(accessToken, `/shipments/${shipmentId}`);
}

// Etiqueta de envio (PDF)
export async function etiquetaEnvioML(accessToken: string, shipmentId: number) {
  return llamarAPIML(accessToken, `/shipments/${shipmentId}/labels`);
}