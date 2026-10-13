import { readFile } from "node:fs/promises"
import sharp from "sharp"
import { resolveUploadedUrlPath } from "@/lib/uploads/storage"

/**
 * Carga el logo de la iglesia para los documentos PDF. Las imágenes subidas se guardan en WebP
 * (que pdfkit no soporta), así que siempre se entrega un PNG acotado, leído del disco si es
 * una subida local o descargado si es una URL externa.
 */
export async function loadLogoPng(url: string | null | undefined, maxPx = 320): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  if (!url) return null
  try {
    let raw: Buffer | null = null
    const local = resolveUploadedUrlPath(url)
    if (local) raw = await readFile(local).catch(() => null)
    if (!raw) {
      const abs = /^https?:/i.test(url) ? url : new URL(url, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString()
      const res = await fetch(abs)
      if (res.ok) raw = Buffer.from(await res.arrayBuffer())
    }
    if (!raw) return null
    const out = await sharp(raw).resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
    return { buffer: out.data, width: out.info.width, height: out.info.height }
  } catch {
    return null
  }
}

/** URL absoluta para correos y documentos HTML. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:/i.test(url)) return url
  return new URL(url, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString()
}
