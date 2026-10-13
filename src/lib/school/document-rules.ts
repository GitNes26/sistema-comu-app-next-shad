// Reglas puras del libro digital: páginas visibles por clase y geometría de apuntes.

export interface PageRange {
  week: number
  fromPage: number
  toPage: number
}

/**
 * Páginas (1..total) que un alumno puede ver cuando la última clase dada es la
 * semana `releasedWeek`. Sin secciones definidas, el documento completo es visible.
 */
export function visiblePagesFor(ranges: PageRange[], releasedWeek: number, total: number): number[] {
  if (ranges.length === 0) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>()
  for (const r of ranges) {
    if (r.week > releasedWeek) continue
    for (let p = Math.max(1, r.fromPage); p <= Math.min(total, r.toPage); p++) set.add(p)
  }
  return [...set].sort((a, b) => a - b)
}

export const ANNOTATION_KINDS = ["highlight", "text", "note"] as const
export type AnnotationKindKey = (typeof ANNOTATION_KINDS)[number]
export const isAnnotationKind = (v: unknown): v is AnnotationKindKey => ANNOTATION_KINDS.includes(v as AnnotationKindKey)

export interface NRect {
  x: number
  y: number
  w: number
  h: number
}

/** Rectángulos normalizados (0–1) válidos y acotados; descarta lo demás. */
export function sanitizeRects(raw: unknown, max = 60): NRect[] {
  if (!Array.isArray(raw)) return []
  const clamp = (n: unknown) => {
    const v = typeof n === "number" ? n : Number(n)
    return Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 10000) / 10000)) : null
  }
  const out: NRect[] = []
  for (const r of raw.slice(0, max)) {
    const o = (r ?? {}) as Record<string, unknown>
    const x = clamp(o.x)
    const y = clamp(o.y)
    const w = clamp(o.w)
    const h = clamp(o.h)
    if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) continue
    out.push({ x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) })
  }
  return out
}

// ── Word → páginas HTML ──────────────────────────────────────────────────────

/** Quita lo peligroso del HTML que genera mammoth (scripts, eventos, enlaces no http). */
export function sanitizeDocxHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, attr: string, _q: string, d: string, s: string) => {
      const v = (d ?? s ?? "").trim()
      const ok = attr.toLowerCase() === "src" ? /^(https?:|data:image\/(png|jpe?g|gif|webp);base64,)/i.test(v) : /^(https?:|mailto:|#)/i.test(v)
      return ok ? m : ` ${attr}="#"`
    })
}

/** Divide el documento en «páginas»: por encabezados y por tamaño aproximado. */
export function paginateHtml(html: string, maxChars = 3500): string[] {
  const blocks = html.match(/<(p|h[1-6]|ul|ol|table|blockquote)[\s>][\s\S]*?<\/\1>/gi) ?? [html]
  const pages: string[] = []
  let current = ""
  for (const b of blocks) {
    const startsSection = /^<h[12][\s>]/i.test(b)
    if (current && (current.length + b.length > maxChars || (startsSection && current.length > 600))) {
      pages.push(current)
      current = ""
    }
    current += b
  }
  if (current) pages.push(current)
  return pages.length > 0 ? pages : ["<p></p>"]
}
