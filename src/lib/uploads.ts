// Helper de subida de archivos al endpoint /api/uploads.

interface UploadResponse {
  ok?: boolean;
  url?: string;
  thumbUrl?: string | null;
  error?: string;
}

export async function uploadFile(file: File): Promise<string> {
  const { url } = await uploadFileWithThumb(file);
  return url;
}

/**
 * Sube un archivo y devuelve la URL principal junto con la miniatura (si el
 * servidor la generó — no para GIF animados ni subidas sin procesar).
 */
export async function uploadFileWithThumb(file: File): Promise<{ url: string; thumbUrl: string | null }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as UploadResponse | null;
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "No se pudo subir el archivo");
  return { url: data.url ?? "", thumbUrl: data.thumbUrl ?? null };
}

/**
 * URL de la miniatura de una imagen subida por /api/uploads: el servidor
 * guarda el par `<uuid>.webp` + `<uuid>-thumb.webp` con el mismo nombre base.
 * Devuelve null para URLs que no son del almacenamiento local (placeholder
 * route, URLs externas): allí no hay miniatura garantizada.
 */
export function thumbnailUrl(url: string | null | undefined): string | null {
  if (!url || (!url.startsWith("/uploads/") && !url.startsWith("/api/media/"))) return null;
  const dot = url.lastIndexOf(".");
  if (dot <= url.lastIndexOf("/")) return null; // sin extensión
  return `${url.slice(0, dot)}-thumb.webp`;
}

export const UPLOAD_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
