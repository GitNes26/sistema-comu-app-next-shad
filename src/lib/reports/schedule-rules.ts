// Reglas puras del envío programado: cuándo toca enviar y qué periodo cubre.
// Todo se calcula en la zona horaria de la iglesia, no en la del servidor.

import type { ReportPeriod } from "./types"

export type Frequency = "weekly" | "monthly"
export const FREQUENCIES: Record<Frequency, string> = { weekly: "Cada semana", monthly: "Cada mes" }
export const isFrequency = (v: unknown): v is Frequency => v === "weekly" || v === "monthly"

export interface Slot {
  frequency: Frequency
  /** 0 = domingo … 6 = sábado. */
  dayOfWeek: number
  /** 1–28. */
  dayOfMonth: number
  /** 0–23 hora local. */
  hour: number
}

export const MAX_RECIPIENTS = 10
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/

/** Correos válidos, sin repetir y en minúsculas; descarta los inválidos. */
export function parseRecipients(input: unknown): { valid: string[]; invalid: string[] } {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\s,;]+/) : []
  const valid: string[] = []
  const invalid: string[] = []
  for (const r of raw) {
    const e = String(r).trim().toLowerCase()
    if (!e) continue
    if (EMAIL.test(e) && e.length <= 120) {
      if (!valid.includes(e)) valid.push(e)
    } else invalid.push(e)
  }
  return { valid, invalid }
}

export function normalizeSlot(input: { frequency?: unknown; dayOfWeek?: unknown; dayOfMonth?: unknown; hour?: unknown }): Slot | null {
  if (!isFrequency(input.frequency)) return null
  const int = (v: unknown, min: number, max: number, d: number) => {
    if (v === undefined || v === null || v === "") return d
    const n = Number(v)
    return Number.isInteger(n) && n >= min && n <= max ? n : NaN
  }
  const dayOfWeek = int(input.dayOfWeek, 0, 6, 1)
  const dayOfMonth = int(input.dayOfMonth, 1, 28, 1)
  const hour = int(input.hour, 0, 23, 8)
  if ([dayOfWeek, dayOfMonth, hour].some(Number.isNaN)) return null
  return { frequency: input.frequency, dayOfWeek, dayOfMonth, hour }
}

// ── Zona horaria ─────────────────────────────────────────────────────────────

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    fmtCache.set(tz, f)
  }
  return f
}

export function validTimezone(tz: string): boolean {
  try {
    formatter(tz).format(new Date())
    return true
  } catch {
    return false
  }
}

/** Fecha y hora locales de un instante en la zona dada. */
export function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(formatter(tz).formatToParts(date).map((x) => [x.type, x.value]))
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute) }
}

const offsetMs = (date: Date, tz: string) => {
  const l = localParts(date, tz)
  const sec = Number(Object.fromEntries(formatter(tz).formatToParts(date).map((x) => [x.type, x.value])).second)
  return Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, sec) - date.getTime()
}

/** Instante UTC que corresponde a una hora local de esa zona. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0)
  let utc = guess - offsetMs(new Date(guess), tz)
  utc = guess - offsetMs(new Date(utc), tz) // segunda pasada: cambios de horario
  return new Date(utc)
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const addDays = (y: number, m: number, d: number, n: number) => {
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Siguiente envío estrictamente posterior a `after`. */
export function nextRunAfter(slot: Slot, after: Date, tz: string): Date {
  const start = localParts(after, tz)
  for (let i = 0; i <= 62; i++) {
    const c = addDays(start.year, start.month, start.day, i)
    const weekday = new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay()
    const matches = slot.frequency === "weekly" ? weekday === slot.dayOfWeek : c.d === slot.dayOfMonth
    if (!matches) continue
    const at = zonedToUtc(c.y, c.m, c.d, slot.hour, tz)
    if (at.getTime() > after.getTime()) return at
  }
  throw new Error("No se pudo calcular el siguiente envío")
}

/**
 * Periodo que cubre el envío hecho en `runAt`: la última semana completa (lunes a
 * domingo) o el último mes completo, ya terminados.
 */
export function periodForRun(frequency: Frequency, runAt: Date, tz: string): ReportPeriod {
  const l = localParts(runAt, tz)
  if (frequency === "monthly") {
    const prevMonth = l.month === 1 ? 12 : l.month - 1
    const year = l.month === 1 ? l.year - 1 : l.year
    const last = new Date(Date.UTC(year, prevMonth, 0)).getUTCDate()
    return { from: ymd(year, prevMonth, 1), to: ymd(year, prevMonth, last) }
  }
  const weekday = new Date(Date.UTC(l.year, l.month - 1, l.day)).getUTCDay() // 0 = domingo
  // Último domingo anterior al día de hoy.
  const back = weekday === 0 ? 7 : weekday
  const end = addDays(l.year, l.month, l.day, -back)
  const start = addDays(end.y, end.m, end.d, -6)
  return { from: ymd(start.y, start.m, start.d), to: ymd(end.y, end.m, end.d) }
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
export function slotLabel(slot: Slot): string {
  const hh = `${String(slot.hour).padStart(2, "0")}:00`
  return slot.frequency === "weekly" ? `Cada ${DAYS[slot.dayOfWeek]} a las ${hh}` : `El día ${slot.dayOfMonth} de cada mes a las ${hh}`
}
