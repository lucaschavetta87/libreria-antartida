/**
 * Utilidades para preparar imagenes antes de subirlas.
 *
 * Las fotos que se sacan con el celular llegan en vertical y pesan mas de 1 MB.
 * Si se suben asi, el hero las estira con object-fit: cover y se ven pixeladas
 * en pantallas grandes (ademas de cargar lento en datos moviles).
 *
 * Aqui recortamos al centro, ajustamos el tamano y recomprimimos.
 */

// El hero se muestra hasta 1920px de ancho en pantallas grandes.
// Solo redimensionamos: la imagen nunca se recorta, el CSS la encuadra.
export const HERO_ANCHO_MAXIMO = 1920;
export const HERO_ALTO_MAXIMO = 1920;
export const HERO_CALIDAD = 0.85;

interface OpcionesRecorte {
  anchoMaximo: number;
  altoMaximo: number;
  calidad: number;
}

/**
 * Avisa cuando la imagen es demasiado chica para las fotos grandes del sitio.
 * Una imagen de 447px estirada a 1440px se ve pixelada y no hay forma de arreglarlo
 * agrandándola: la calidad se decide al subirla.
 */
export async function medirImagen(archivo: File): Promise<{ ancho: number; alto: number } | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = await esperarImagen(await leerComoDataUrl(archivo));
    return { ancho: img.naturalWidth, alto: img.naturalHeight };
  } catch {
    return null;
  }
}

export function recomendacionesImagenHero(medida: { ancho: number; alto: number } | null): string[] {
  if (!medida) return [];
  const avisos: string[] = [];
  // El hero se muestra hasta 1920px de ancho en pantallas grandes.
  if (medida.ancho < 1280) {
    avisos.push(`La imagen mide ${medida.ancho}px de ancho y se va a ver pixelada en pantallas grandes. Subí una foto de al menos 1280px de ancho (ideal 1920).`);
  }
  if (medida.ancho < medida.alto) {
    avisos.push('La imagen es vertical: en el hero se va a ver recortada por los costados. Se recomienda una imagen apaisada (horizontal).');
  }
  return avisos;
}

const esperarImagen = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo leer la imagen'));
  img.src = src;
});

const leerComoDataUrl = (archivo: File) => new Promise<string>((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result as string);
  lector.onerror = () => reject(lector.error);
  lector.readAsDataURL(archivo);
});

/**
 * Recorta al centro, escala y recomprime una imagen.
 * Si el navegador no soporta el formato de salida, devuelve el archivo original.
 */
export async function prepararImagen(
  archivo: File,
  opciones: Partial<OpcionesRecorte> = {}
): Promise<File> {
  const { anchoMaximo, altoMaximo, calidad }: OpcionesRecorte = {
    anchoMaximo: opciones.anchoMaximo ?? 1200,
    altoMaximo: opciones.altoMaximo ?? 1200,
    calidad: opciones.calidad ?? 0.85
  };

  // En el servidor no hay DOM ni canvas: devolvemos el archivo tal cual.
  if (typeof document === 'undefined') return archivo;

  try {
    const dataUrl = await leerComoDataUrl(archivo);
    const img = await esperarImagen(dataUrl);

    const anchoOriginal = img.naturalWidth;
    const altoOriginal = img.naturalHeight;
    if (!anchoOriginal || !altoOriginal) return archivo;

    // SOLO REDIMENSIONAMOS: mantenemos la proporcion y no cortamos nada.
    // El recorte lo hace el CSS con object-fit: cover, asi que la imagen
    // conserva todo su contenido y se encuadra sola en cada pantalla.
    const escala = Math.min(1, anchoMaximo / anchoOriginal, altoMaximo / altoOriginal);
    const anchoFinal = Math.max(1, Math.round(anchoOriginal * escala));
    const altoFinal = Math.max(1, Math.round(altoOriginal * escala));

    // Si ya es chica y liviana, no hay nada que hacer.
    if (anchoFinal === anchoOriginal && altoFinal === altoOriginal && archivo.size < 400_000) {
      return archivo;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = anchoFinal;
    lienzo.height = altoFinal;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return archivo;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Imagen completa, sin recortar
    ctx.drawImage(img, 0, 0, anchoFinal, altoFinal);

    const blobFinal = await new Promise<Blob | null>((resolve) =>
      lienzo.toBlob(resolve, 'image/jpeg', calidad)
    );
    if (!blobFinal) return archivo;

    const nombreBase = archivo.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    return new File([blobFinal], `${nombreBase}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('No se pudo procesar la imagen, se sube original:', err);
    return archivo;
  }
}

/** Prepara una imagen para el carrusel del hero: sola escala, sin recortar. */
export function prepararImagenHero(archivo: File): Promise<File> {
  return prepararImagen(archivo, {
    anchoMaximo: HERO_ANCHO_MAXIMO,
    altoMaximo: HERO_ALTO_MAXIMO,
    calidad: HERO_CALIDAD
  });
}

/** Prepara una imagen de categoria o producto: sola escala, sin recortar. */
export function prepararImagenRedimensionada(archivo: File, anchoMaximo = 1200): Promise<File> {
  return prepararImagen(archivo, {
    anchoMaximo,
    altoMaximo: anchoMaximo,
    calidad: 0.85
  });
}

/**
 * Sube un archivo a un bucket y devuelve la URL publica.
 * Se usa para no repetir la logica de subida en cada componente.
 */
export async function subirArchivoAStorage(
  supabase: any,
  bucket: string,
  archivo: File
): Promise<string | null> {
  try {
    const extension = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
    const nombreSinExt = archivo.name.replace(/\.[^/.]+$/, '');
    const nombreLimpio = nombreSinExt
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 40);
    const fileName = `${Date.now()}_${nombreLimpio}.${extension}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, archivo, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error(`Error al subir a ${bucket}:`, error.message);
      throw error;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error('Excepcion en subirArchivoAStorage:', err);
    return null;
  }
}