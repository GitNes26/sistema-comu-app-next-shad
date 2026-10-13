// Reglas puras de Comunidad Kids: edad → salón, QR y lista de verificación.

export interface RoomRange {
  id: string
  name: string
  section: "baby" | "child"
  minAgeMonths: number
  maxAgeMonths: number
  sortOrder: number
  isActive: boolean
}

/** Salones por defecto (el brief: bebés hasta 4 años; 4-5, 6-7, 8-9 y 10-12). */
export const DEFAULT_ROOMS: Omit<RoomRange, "id" | "isActive">[] = [
  { name: "Bebés", section: "baby", minAgeMonths: 0, maxAgeMonths: 47, sortOrder: 0 },
  { name: "4–5 años", section: "child", minAgeMonths: 48, maxAgeMonths: 71, sortOrder: 1 },
  { name: "6–7 años", section: "child", minAgeMonths: 72, maxAgeMonths: 95, sortOrder: 2 },
  { name: "8–9 años", section: "child", minAgeMonths: 96, maxAgeMonths: 119, sortOrder: 3 },
  { name: "10–12 años", section: "child", minAgeMonths: 120, maxAgeMonths: 155, sortOrder: 4 },
]

/** Edad cumplida en meses a la fecha de referencia (nunca negativa). */
export function ageInMonths(birth: Date, ref = new Date()): number {
  let months = (ref.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (ref.getUTCMonth() - birth.getUTCMonth())
  if (ref.getUTCDate() < birth.getUTCDate()) months -= 1
  return Math.max(0, months)
}

/** Texto corto de la edad: «8 meses», «3 años», «5 años 4 m». */
export function ageLabel(birth: Date, ref = new Date()): string {
  const m = ageInMonths(birth, ref)
  if (m < 24) return `${m} ${m === 1 ? "mes" : "meses"}`
  const y = Math.floor(m / 12)
  const rest = m % 12
  return rest && y < 6 ? `${y} años ${rest} m` : `${y} años`
}

/** Salón que le corresponde por edad; null si ninguno cubre esa edad. */
export function roomForAge<T extends RoomRange>(rooms: T[], months: number): T | null {
  const sorted = [...rooms].filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  return sorted.find((r) => months >= r.minAgeMonths && months <= r.maxAgeMonths) ?? null
}

/** Qué debe traer un bebé (lista de verificación al registrarlo). */
export const BABY_CHECKLIST = ["Pañales", "Biberón o leche", "Cambio de ropa", "Chupón", "Cobija"] as const

/** Deja solo elementos conocidos con valor booleano. */
export function sanitizeChecklist(input: unknown, allowed: readonly string[] = BABY_CHECKLIST): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const key of allowed) {
      const v = (input as Record<string, unknown>)[key]
      if (typeof v === "boolean") out[key] = v
    }
  }
  return out
}

const QR_PREFIX = "comuapp-kids:"

/** Contenido que se codifica en el QR del niño. */
export const qrPayload = (token: string) => `${QR_PREFIX}${token}`

/** Extrae el token de lo que leyó el escáner (acepta el token suelto, escrito a mano). */
export function parseQrPayload(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim()
  const token = t.startsWith(QR_PREFIX) ? t.slice(QR_PREFIX.length) : t
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null
}

/** Avisos rápidos del personal hacia los padres. */
export const ALERT_PRESETS = [
  "Necesita cambio de pañal",
  "Está llorando y no se calma",
  "Tiene fiebre o se siente mal",
  "Necesitamos que pase por su hijo(a)",
] as const

export const RELATIONS = ["Padre/Madre", "Tutor(a)", "Abuelo(a)", "Tío(a)", "Otro"] as const

export function isValidBirthDate(d: Date, ref = new Date()): boolean {
  if (Number.isNaN(d.getTime()) || d.getTime() > ref.getTime()) return false
  return ageInMonths(d, ref) <= 18 * 12
}
