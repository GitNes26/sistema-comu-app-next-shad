import path from "node:path"
import { existsSync } from "node:fs"

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/
const SAFE_FILE = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/

export function uploadsRoot() {
  const base = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads")
  const project = process.env.UPLOADS_PROJECT?.trim() || "comu-app"
  if (!SAFE_SEGMENT.test(project)) {
    throw new Error("UPLOADS_PROJECT solo admite letras, números, guion y guion bajo")
  }
  return path.join(base, project)
}

export function uploadedFilePath(organizationId: string, fileName: string) {
  if (!SAFE_SEGMENT.test(organizationId) || !SAFE_FILE.test(fileName)) return null
  return path.join(uploadsRoot(), organizationId, fileName)
}

/** Rutas de lectura del archivo (carpeta aislada del proyecto). */
export function uploadedFileCandidates(organizationId: string, fileName: string) {
  if (!SAFE_SEGMENT.test(organizationId) || !SAFE_FILE.test(fileName)) return []
  const current = path.join(uploadsRoot(), organizationId, fileName)
  return [current]
}

export function uploadedMediaUrl(organizationId: string, fileName: string) {
  return `/api/media/${encodeURIComponent(organizationId)}/${encodeURIComponent(fileName)}`
}

/** Resuelve URLs del almacenamiento local (p. ej. para incrustar en PDFs). */
export function resolveUploadedUrlPath(url: string) {
  const match = url.match(/^\/(?:api\/media|uploads)\/([^/]+)\/([^/?#]+)$/)
  if (!match) return null
  const candidates = uploadedFileCandidates(decodeURIComponent(match[1]), decodeURIComponent(match[2]))
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? null
}
