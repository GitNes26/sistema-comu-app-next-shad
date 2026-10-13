import sharp from "sharp";

/**
 * Procesamiento de imágenes subidas (productos, categorías, publicaciones…).
 *
 * Toda imagen que entra por /api/uploads se normaliza antes de guardarse:
 * - se reescala para que quepa en MAX_DIMENSION (sin agrandar, solo reducir),
 * - se recodifica a WebP con calidad fija,
 * - se genera además una miniatura WebP de THUMB_DIMENSION px para las
 *   cuadrículas densas (POS, ticket, chips de categoría): en una pantalla
 *   llena de tarjetas de 64px, bajar de ~100 KB a ~3-8 KB por imagen reduce
 *   el tráfico del catálogo en un orden de magnitud.
 *
 * así el almacenamiento queda acotado y el catálogo (POS en tabletas, portal
 * en móviles) renderiza rápido: una foto de 12 MP / 5 MB de un teléfono se
 * convierte en un WebP de ~100-200 KB que se ve igual en una tarjeta.
 *
 * Los GIF animados pasan intactos (sharp los aplanaría al primer cuadro) y no
 * generan miniatura: el cliente usa el GIF completo en todas las vistas.
 * Si sharp falla por cualquier motivo, se guarda el original: la subida nunca
 * se pierde por un error del procesador.
 */

/** Tope de ancho/alto en píxeles (una tarjeta de catálogo nunca necesita más). */
export const MAX_DIMENSION = 1024;

/** Calidad WebP de recompresión. */
export const WEBP_QUALITY = 82;

/** Dimensiones de la miniatura para cuadrículas densas. */
export const THUMB_DIMENSION = 256;

/** Calidad WebP de la miniatura (los detalles no se extraen a 64px). */
export const THUMB_QUALITY = 70;

export type ProcessedImage =
  | {
      ok: true;
      buffer: Buffer;
      ext: "webp" | "gif";
      contentType: string;
      thumb: Buffer | null;
    }
  | { ok: false; buffer: Buffer; ext: string; contentType: string; thumb: null };

/**
 * Normaliza una imagen subida. Devuelve el buffer principal listo para
 * guardar en `public/uploads`, más la miniatura (null para GIF animados y
 * procesamiento fallido) con su extensión y content-type reales.
 */
export async function processUploadedImage(
  input: Buffer,
  mimeType: string
): Promise<ProcessedImage> {
  // Los GIF animados se guardan tal cual: sharp solo conserva el primer frame.
  if (mimeType === "image/gif") {
    return { ok: true, buffer: input, ext: "gif", contentType: "image/gif", thumb: null };
  }

  try {
    const pipeline = sharp(input).rotate(); // respeta el EXIF de orientación
    const buffer = await pipeline
      .clone()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside", // nunca recorta ni agranda
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const thumb = await pipeline
      .clone()
      .resize(THUMB_DIMENSION, THUMB_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    return { ok: true, buffer, ext: "webp", contentType: "image/webp", thumb };
  } catch {
    // Entrada corrupta o no decodificable: guardar el original con su tipo.
    const ext = EXT_BY_TYPE[mimeType] ?? "bin";
    return { ok: false, buffer: input, ext, contentType: mimeType, thumb: null };
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
