// Hoja de seguimiento mensual de la célula (sin base de datos): reglas puras para armar la
// hoja que cada hogar de amor entrega: quiénes asistieron cada semana del mes, su crecimiento
// (BA, BES, EJ, EM, EL, UT) y los nuevos creyentes. La arma `followup.ts` y la dibuja `followup-pdf.ts`.

import { DAY_LABEL, timeLabel } from "@/lib/cells/rules"

/** Columnas de «Crecimiento» tal como aparecen en la hoja impresa. */
export const GROWTH_COLUMNS = [
  { key: "ba", short: "BA", label: "Bautismo en agua" },
  { key: "bes", short: "BES", label: "Bautismo en Espíritu Santo" },
  { key: "ej", short: "EJ", label: "Encuentro con Jesús" },
  { key: "em", short: "EM", label: "Escuela de Ministerio" },
  { key: "el", short: "EL", label: "Lanzamiento" },
  { key: "ut", short: "UT", label: "Universidad Teológica" },
] as const
export type GrowthKey = (typeof GROWTH_COLUMNS)[number]["key"]

/** Una marca de crecimiento: hecha, en proceso (con avance «2») o pendiente. */
export interface GrowthMark {
  done: boolean
  /** Avance parcial (p. ej. libros aprobados de la Escuela de Ministerio). */
  partial?: number
}

export const SHEET_WEEKS = 5
export const SHEET_SHEEP_ROWS = 18
export const SHEET_NEW_ROWS = 4

export const MONTH_LABEL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] as const

/** Todas las fechas (YYYY-MM-DD) del mes en que cae `dow` (0 = domingo): las 4 o 5 reuniones. */
export function occurrencesInMonth(year: number, monthIndex: number, dow: number): string[] {
  const out: string[] = []
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  for (let d = 1; d <= days; d++) {
    if (new Date(Date.UTC(year, monthIndex, d)).getUTCDay() === dow) out.push(new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10))
  }
  return out
}

/**
 * Columna (0–4) de la hoja a la que pertenece una reunión: la semana del día de reunión de la
 * célula; si se hizo otro día, la semana del mes (días 1–7 → 1, 8–14 → 2…).
 */
export function weekColumn(dateYmd: string, occurrences: string[]): number {
  const i = occurrences.indexOf(dateYmd)
  if (i >= 0) return Math.min(i, SHEET_WEEKS - 1)
  return Math.min(Math.ceil(Number(dateYmd.slice(8, 10)) / 7), SHEET_WEEKS) - 1
}

export interface SheetPerson {
  memberId: string
  fullName: string
  phone: string | null
  role: "leader" | "support" | "member"
  baptizedWater: boolean
  baptizedFire: boolean
  encounterAt: Date | null
  launchAt: Date | null
  /** Libros aprobados / total de la Escuela de Ministerio. */
  ministryPassed: number
  ministryTotal: number
  /** Cursos aprobados de la Universidad Teológica. */
  theologyPassed: number
}

export interface SheetMeeting {
  date: string
  notes: string | null
  /** memberId → presente. */
  attendance: Map<string, { present: boolean; isNew: boolean }>
}

export interface SheetRow {
  n: number
  memberId: string
  name: string
  phone: string | null
  /** true = asistió, false = faltó, null = no hubo reunión esa semana o no se pasó lista. */
  weeks: (boolean | null)[]
  growth: Record<GrowthKey, GrowthMark>
}

export interface FollowUpSheet {
  month: string
  monthLabel: string
  cell: {
    name: string
    leaders: string[]
    leaderPhone: string | null
    neighborhood: string | null
    street: string | null
    schedule: string
    host: string | null
    network: string | null
    pastor: string | null
  }
  /** Fecha de la reunión de cada semana (5 columnas), o null si no hubo. */
  weekDates: (string | null)[]
  sheep: SheetRow[]
  newBelievers: SheetRow[]
  /** Presentes por semana (ovejas + nuevos creyentes). */
  presentPerWeek: number[]
  sheepCount: number
  observations: string[]
  legend: { short: string; label: string }[]
}

function growthOf(p: SheetPerson): Record<GrowthKey, GrowthMark> {
  const em: GrowthMark =
    p.ministryTotal > 0 && p.ministryPassed >= p.ministryTotal
      ? { done: true }
      : p.launchAt !== null
        ? { done: true }
        : { done: false, partial: p.ministryPassed > 0 ? p.ministryPassed : undefined }
  return {
    ba: { done: p.baptizedWater },
    bes: { done: p.baptizedFire },
    ej: { done: p.encounterAt !== null },
    em,
    el: { done: p.launchAt !== null },
    ut: p.theologyPassed > 0 ? { done: false, partial: p.theologyPassed } : { done: false },
  }
}

/** Arma la hoja del mes: asistencia por semana, crecimiento y nuevos creyentes. */
export function buildFollowUpSheet(input: {
  year: number
  monthIndex: number
  cell: {
    name: string
    dayOfWeek: number
    startTime: string
    host: string | null
    network: string | null
    pastor: string | null
    street: string | null
    neighborhood: string | null
  }
  people: SheetPerson[]
  meetings: SheetMeeting[]
}): FollowUpSheet {
  const { year, monthIndex, cell, people, meetings } = input
  const occurrences = occurrencesInMonth(year, monthIndex, cell.dayOfWeek)
  const weekDates: (string | null)[] = Array.from({ length: SHEET_WEEKS }, (_, i) => occurrences[i] ?? null)
  // Una reunión fuera de su día fija la fecha de su semana si esa columna no tiene otra.
  const byWeek: (SheetMeeting | null)[] = Array(SHEET_WEEKS).fill(null)
  for (const m of [...meetings].sort((a, b) => a.date.localeCompare(b.date))) {
    const col = weekColumn(m.date, occurrences)
    if (!byWeek[col] || m.date === weekDates[col]) byWeek[col] = m
    if (!weekDates[col] || m.date !== weekDates[col]) weekDates[col] = byWeek[col]!.date
  }

  const isNewInMonth = (id: string) => meetings.some((m) => m.attendance.get(id)?.isNew)
  const toRow = (p: SheetPerson, n: number): SheetRow => ({
    n,
    memberId: p.memberId,
    name: p.fullName,
    phone: p.phone,
    weeks: byWeek.map((m) => {
      if (!m) return null
      const a = m.attendance.get(p.memberId)
      return a ? a.present : null
    }),
    growth: growthOf(p),
  })

  const order = { leader: 0, support: 1, member: 2 } as const
  const sorted = [...people].sort((a, b) => order[a.role] - order[b.role] || a.fullName.localeCompare(b.fullName, "es"))
  const sheepPeople = sorted.filter((p) => !isNewInMonth(p.memberId))
  const newPeople = sorted.filter((p) => isNewInMonth(p.memberId))
  const sheep = sheepPeople.map((p, i) => toRow(p, i + 1))
  const newBelievers = newPeople.map((p, i) => toRow(p, i + 1))
  const all = [...sheep, ...newBelievers]
  const presentPerWeek = Array.from({ length: SHEET_WEEKS }, (_, w) => all.filter((r) => r.weeks[w] === true).length)

  const leaders = sorted.filter((p) => p.role === "leader")
  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    monthLabel: `${MONTH_LABEL[monthIndex]} ${year}`,
    cell: {
      name: cell.name,
      leaders: leaders.map((l) => l.fullName),
      leaderPhone: leaders.find((l) => l.phone)?.phone ?? null,
      neighborhood: cell.neighborhood,
      street: cell.street,
      schedule: `${DAY_LABEL[cell.dayOfWeek]} ${timeLabel(cell.startTime)}`,
      host: cell.host,
      network: cell.network,
      pastor: cell.pastor,
    },
    weekDates,
    sheep,
    newBelievers,
    presentPerWeek,
    sheepCount: sheep.length,
    observations: meetings
      .filter((m) => m.notes && m.notes.trim())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => `${m.date.slice(8, 10)}/${m.date.slice(5, 7)}: ${m.notes!.trim()}`),
    legend: GROWTH_COLUMNS.map((g) => ({ short: g.short, label: g.label })),
  }
}
