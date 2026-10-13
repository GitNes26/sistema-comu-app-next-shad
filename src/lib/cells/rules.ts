// Reglas puras de Células y redes (sin base de datos).

export const DAY_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const

export const CELL_ROLES = ["leader", "support", "member"] as const
export type CellRoleKey = (typeof CELL_ROLES)[number]
export const CELL_ROLE_LABEL: Record<CellRoleKey, string> = { leader: "Líder", support: "Apoyo", member: "Integrante" }
export const isCellRole = (v: unknown): v is CellRoleKey => CELL_ROLES.includes(v as CellRoleKey)

/** Una célula tiene 1 o 2 líderes y un apoyo (quien se prepara para ser líder). */
export const MAX_LEADERS = 2
export const MAX_SUPPORT = 1

export const DEFAULT_CELL_TYPES = ["De mujeres", "De matrimonios", "De jóvenes"] as const

export const VISION_STAGES = ["win", "consolidate", "encounter", "school", "launch", "leadership", "discipleship"] as const
export type VisionStageKey = (typeof VISION_STAGES)[number]
export const VISION_STAGE_LABEL: Record<VisionStageKey, string> = {
  win: "Ganar",
  consolidate: "Consolidar",
  encounter: "Encuentro",
  school: "Escuela",
  launch: "Lanzamiento",
  leadership: "Liderazgo",
  discipleship: "Discipulado",
}
export const isVisionStage = (v: unknown): v is VisionStageKey => VISION_STAGES.includes(v as VisionStageKey)

export const isValidTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
export const isValidDay = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6

/** Hora «19:30» → «7:30 p. m.». */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const suffix = h >= 12 ? "p. m." : "a. m."
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

/**
 * Último día del mes en que cae `dow` (0=domingo). Es el día del festejo de
 * cumpleañeros: la última reunión de la célula del mes.
 * `monthIndex` es 0–11.
 */
export function lastOccurrenceInMonth(year: number, monthIndex: number, dow: number): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))
  const back = (last.getUTCDay() - dow + 7) % 7
  return new Date(Date.UTC(year, monthIndex, last.getUTCDate() - back))
}

/** Próxima fecha (de hoy en adelante) en que se reúne la célula. */
export function nextOccurrence(dow: number, from = new Date()): Date {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const ahead = (dow - base.getUTCDay() + 7) % 7
  return new Date(base.getTime() + ahead * 86_400_000)
}

export interface BirthdayPerson {
  memberId: string
  fullName: string
  birthDate: Date | null
}
export interface Birthday {
  memberId: string
  fullName: string
  day: number
  /** Edad que cumple en ese mes (null si no hay año de nacimiento fiable). */
  turns: number | null
}

/** Cumpleañeros de un mes (monthIndex 0–11), ordenados por día. */
export function birthdaysOfMonth(people: BirthdayPerson[], year: number, monthIndex: number): Birthday[] {
  return people
    .filter((p): p is BirthdayPerson & { birthDate: Date } => p.birthDate !== null && p.birthDate.getUTCMonth() === monthIndex)
    .map((p) => ({
      memberId: p.memberId,
      fullName: p.fullName,
      day: p.birthDate.getUTCDate(),
      turns: year - p.birthDate.getUTCFullYear() > 0 ? year - p.birthDate.getUTCFullYear() : null,
    }))
    .sort((a, b) => a.day - b.day || a.fullName.localeCompare(b.fullName, "es"))
}

/** Un traspaso solo puede decidirse mientras está pendiente. */
export function canDecideTransfer(status: string): boolean {
  return status === "pending"
}
