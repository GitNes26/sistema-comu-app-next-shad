// Reglas puras de Alabanza (sin Prisma): semanas, tonos, enlaces y transiciones.

/** Tonos musicales aceptados (mayores, menores y sostenidos/bemoles comunes). */
const NOTES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"] as const
export const SONG_KEYS: string[] = [...NOTES, ...NOTES.map((n) => `${n}m`)]

/** Normaliza un tono («g» → «G», «f#M» → «F#», «am» → «Am»); null si no es válido. */
export function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim().replace(/\s+/g, "")
  if (!raw) return null
  const minor = /m(in)?$/i.test(raw) && !/maj$/i.test(raw)
  const base = raw.replace(/(m(in)?|maj|M)$/i, "")
  if (!base) return null
  const note = base.charAt(0).toUpperCase() + base.slice(1).replace(/♯/g, "#").replace(/♭/g, "b").replace(/B$/, "b")
  const candidate = minor ? `${note}m` : note
  return SONG_KEYS.includes(candidate) ? candidate : null
}

export interface SongLink {
  label: string
  url: string
}

/** Depura una lista de enlaces: solo http(s), con etiqueta, máximo 10. */
export function sanitizeLinks(input: unknown): SongLink[] {
  if (!Array.isArray(input)) return []
  const out: SongLink[] = []
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const { label, url } = item as { label?: unknown; url?: unknown }
    const u = typeof url === "string" ? url.trim() : ""
    if (!/^https?:\/\/[^\s]+$/i.test(u) || u.length > 500) continue
    try {
      new URL(u)
    } catch {
      continue
    }
    const l = typeof label === "string" && label.trim() ? label.trim().slice(0, 60) : hostOf(u)
    out.push({ label: l, url: u })
    if (out.length >= 10) break
  }
  return out
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Enlace"
  }
}

/** Lunes (00:00 UTC) de la semana que contiene la fecha dada (YYYY-MM-DD o Date). */
export function weekStartOf(input: string | Date): Date {
  const d = typeof input === "string" ? new Date(`${input.slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()))
  if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida")
  const day = d.getUTCDay() // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

export const toYmd = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

/** Rango [inicio, fin) de un mes «YYYY-MM» en UTC. */
export function monthRange(month: string): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error("Mes inválido")
  const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1))
  return { from, to }
}

export const ROSTER_STATUS_LABEL = { pending: "Por confirmar", confirmed: "Confirmó", declined: "No puede" } as const
export type RosterStatusKey = keyof typeof ROSTER_STATUS_LABEL
export const ROSTER_STATUSES = Object.keys(ROSTER_STATUS_LABEL) as RosterStatusKey[]

export const AUDITION_STATUS_LABEL = { scheduled: "Programada", passed: "Aprobada", failed: "No aprobada", cancelled: "Cancelada" } as const
export type AuditionStatusKey = keyof typeof AUDITION_STATUS_LABEL
export const AUDITION_STATUSES = Object.keys(AUDITION_STATUS_LABEL) as AuditionStatusKey[]

/** Una audición solo se resuelve (o cancela) mientras está programada. */
export function canResolveAudition(from: AuditionStatusKey, to: AuditionStatusKey): boolean {
  return from === "scheduled" && (to === "passed" || to === "failed" || to === "cancelled")
}

export function isRosterStatus(v: unknown): v is RosterStatusKey {
  return typeof v === "string" && (ROSTER_STATUSES as string[]).includes(v)
}

export function isAuditionStatus(v: unknown): v is AuditionStatusKey {
  return typeof v === "string" && (AUDITION_STATUSES as string[]).includes(v)
}

/** Mueve un elemento en una lista (reordenar el programa). Devuelve una copia. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list]
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length || from === to) return copy
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}
