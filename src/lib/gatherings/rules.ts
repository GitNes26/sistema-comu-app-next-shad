// Reglas puras de reuniones generales y de jóvenes (sin base de datos).

export const GATHERING_KINDS = ["general", "youth"] as const
export type GatheringKindKey = (typeof GATHERING_KINDS)[number]
export const GATHERING_KIND_LABEL: Record<GatheringKindKey, string> = { general: "Reunión general", youth: "Reunión de jóvenes" }
export const isGatheringKind = (v: unknown): v is GatheringKindKey => GATHERING_KINDS.includes(v as GatheringKindKey)

export const CATEGORIES = ["men", "women", "youth", "kids", "new"] as const
export type CategoryKey = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  men: "Hombres",
  women: "Mujeres",
  youth: "Jóvenes",
  kids: "Niños",
  new: "Nuevos",
}

export type Counts = Record<CategoryKey, number>

export const MAX_COUNT = 100_000

/** Asistencia total: «nuevos» es un subconjunto de las demás categorías y no suma. */
export function totalAttendance(c: Counts): number {
  return c.men + c.women + c.youth + c.kids
}

/** Normaliza un conteo capturado: entero entre 0 y MAX_COUNT; null si no es válido. */
export function parseCount(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isInteger(n) && n >= 0 && n <= MAX_COUNT ? n : null
}

/** «Nuevos» no puede ser mayor que la asistencia total registrada. */
export function newExceedsTotal(c: Counts): boolean {
  return c.new > totalAttendance(c)
}

export interface ReportRow {
  date: string
  counts: Counts
}

/** Totales y promedio de un conjunto de reuniones. */
export function summarize(rows: ReportRow[]) {
  const totals: Counts = { men: 0, women: 0, youth: 0, kids: 0, new: 0 }
  for (const r of rows) for (const k of CATEGORIES) totals[k] += r.counts[k]
  const total = totalAttendance(totals)
  return {
    totals,
    total,
    average: rows.length === 0 ? 0 : Math.round((total / rows.length) * 10) / 10,
    best: rows.reduce<{ date: string; total: number } | null>((best, r) => {
      const t = totalAttendance(r.counts)
      return !best || t > best.total ? { date: r.date, total: t } : best
    }, null),
  }
}

/** Fecha (YYYY-MM-DD, UTC) de la última vez que cayó `dow` hasta `from` inclusive. */
export function lastOccurrenceOnOrBefore(dow: number, from = new Date()): string {
  const base = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
  const back = (base.getUTCDay() - dow + 7) % 7
  return new Date(base.getTime() - back * 86_400_000).toISOString().slice(0, 10)
}
