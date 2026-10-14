// Flyer de una publicación (sin base de datos): plantilla según el tipo de aviso,
// colores y tipografía editables, imagen opcional, o un flyer propio ya diseñado.
// El servidor solo guarda lo que `normalizeFlyer` deja pasar.

import type { PostKind } from "@/lib/portal/rules"

export const FLYER_MODES = { template: "Diseñarlo aquí", upload: "Subir el mío" } as const
export type FlyerMode = keyof typeof FLYER_MODES

export const FLYER_FONTS = {
  sans: { label: "Moderna", css: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', weight: 800 },
  serif: { label: "Clásica", css: 'Georgia, "Times New Roman", Times, serif', weight: 700 },
  display: { label: "Impacto", css: 'Impact, "Arial Narrow Bold", "Haettenschweiler", sans-serif', weight: 400 },
  script: { label: "Elegante", css: '"Palatino Linotype", "Book Antiqua", Palatino, serif', weight: 600 },
  mono: { label: "Técnica", css: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace', weight: 700 },
} as const
export type FlyerFont = keyof typeof FLYER_FONTS

/** Cada tipo de aviso tiene su propia composición. */
export const FLYER_TEMPLATES = {
  announcement: "Anuncio · cartel con titular grande",
  devotional: "Devocional · cita centrada",
  article: "Artículo · editorial con franja",
  news: "Noticia · titular con cintillo",
} as const satisfies Record<PostKind, string>

export interface FlyerDesign {
  mode: "template"
  template: PostKind
  bg: string
  fg: string
  accent: string
  font: FlyerFont
  /** Imagen opcional dentro del flyer (https o ruta propia). */
  imageUrl: string | null
  /** Texto de apoyo bajo el titular (opcional). Si no hay, se usa un extracto del contenido. */
  subtitle: string | null
  /** Pie del flyer: lugar, fecha, contacto… (opcional). */
  footer: string | null
}
export interface FlyerUpload {
  mode: "upload"
  url: string
}
export type Flyer = FlyerDesign | FlyerUpload

export const FLYER_PALETTES: { key: string; label: string; bg: string; fg: string; accent: string }[] = [
  { key: "ocean", label: "Océano", bg: "#0f2a4a", fg: "#ffffff", accent: "#f5b942" },
  { key: "sunrise", label: "Amanecer", bg: "#fff4e0", fg: "#3b2410", accent: "#e8590c" },
  { key: "forest", label: "Bosque", bg: "#12372a", fg: "#f1f7f3", accent: "#9be15d" },
  { key: "royal", label: "Realeza", bg: "#2e1a5e", fg: "#ffffff", accent: "#ffd166" },
  { key: "rose", label: "Rosa", bg: "#fde8ef", fg: "#4a1230", accent: "#d6336c" },
  { key: "graphite", label: "Grafito", bg: "#1c1f26", fg: "#f5f6f8", accent: "#4dabf7" },
]

const DEFAULTS: Record<PostKind, { palette: string; font: FlyerFont }> = {
  announcement: { palette: "ocean", font: "display" },
  devotional: { palette: "sunrise", font: "serif" },
  article: { palette: "graphite", font: "sans" },
  news: { palette: "royal", font: "sans" },
}

export function defaultFlyer(kind: PostKind): FlyerDesign {
  const d = DEFAULTS[kind]
  const p = FLYER_PALETTES.find((x) => x.key === d.palette)!
  return { mode: "template", template: kind, bg: p.bg, fg: p.fg, accent: p.accent, font: d.font, imageUrl: null, subtitle: null, footer: null }
}

const HEX = /^#[0-9a-fA-F]{6}$/
const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const safeUrl = (v: unknown): string | null => {
  const s = clean(v, 500)
  return s && /^(https:\/\/|\/)/.test(s) ? s : null
}
const isKind = (v: unknown): v is PostKind => typeof v === "string" && v in FLYER_TEMPLATES

/** Convierte una entrada libre en un flyer válido, o `null` si no hay flyer. Nunca lanza. */
export function normalizeFlyer(input: unknown, fallbackKind: PostKind = "announcement"): Flyer | null {
  if (!input || typeof input !== "object") return null
  const o = input as Record<string, unknown>
  if (o.mode === "upload") {
    const url = safeUrl(o.url)
    return url ? { mode: "upload", url } : null
  }
  if (o.mode !== "template") return null
  const base = defaultFlyer(isKind(o.template) ? o.template : fallbackKind)
  return {
    mode: "template",
    template: base.template,
    bg: typeof o.bg === "string" && HEX.test(o.bg) ? o.bg.toLowerCase() : base.bg,
    fg: typeof o.fg === "string" && HEX.test(o.fg) ? o.fg.toLowerCase() : base.fg,
    accent: typeof o.accent === "string" && HEX.test(o.accent) ? o.accent.toLowerCase() : base.accent,
    font: typeof o.font === "string" && o.font in FLYER_FONTS ? (o.font as FlyerFont) : base.font,
    imageUrl: safeUrl(o.imageUrl),
    subtitle: clean(o.subtitle, 160),
    footer: clean(o.footer, 120),
  }
}

/** Extracto del contenido para el flyer cuando no se escribió subtítulo. */
export function excerpt(body: string, max = 140): string {
  const flat = body.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

/** Relación luminosidad (WCAG) entre dos colores #rrggbb, para avisar de poco contraste. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}
