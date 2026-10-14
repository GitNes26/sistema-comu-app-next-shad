// Reglas puras de Finanzas: vencimientos de vehículos y resúmenes (la nómina vive en lib/payroll).

const round2 = (n: number) => Math.round(n * 100) / 100

export const INCOME_KIND_LABEL: Record<string, string> = {
  tithe: "Diezmo",
  offering: "Ofrenda",
  donation: "Donativo",
  event: "Evento",
  school: "Escuela",
  other: "Otro",
}
export const INCOME_SOURCE_LABEL: Record<string, string> = {
  cash_cut: "Corte de reunión",
  transfer: "Transferencia",
  online: "En línea",
  other: "Otro",
}
export const EXPENSE_CATEGORIES = ["nomina", "servicios", "renta", "mantenimiento", "vehiculo", "material", "honorarios", "comida", "hotel", "transporte", "ayuda", "otro"] as const
export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  nomina: "Nómina",
  servicios: "Servicios (luz, agua, internet)",
  renta: "Renta",
  mantenimiento: "Mantenimiento",
  vehiculo: "Vehículos",
  material: "Material",
  honorarios: "Honorarios",
  comida: "Comida",
  hotel: "Hotel",
  transporte: "Transporte",
  ayuda: "Ayuda social",
  otro: "Otro",
}

export type DocStatus = "ok" | "soon" | "expired" | "none"

/** Estado de un vencimiento: «soon» si faltan `warnDays` días o menos. */
export function expiryStatus(expiresAt: Date | null, today = new Date(), warnDays = 30): DocStatus {
  if (!expiresAt) return "none"
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const days = Math.floor((expiresAt.getTime() - t) / 86_400_000)
  if (days < 0) return "expired"
  return days <= warnDays ? "soon" : "ok"
}

/** Kilómetros por litro entre dos cargas con odómetro; null si no hay datos válidos. */
export function kmPerLiter(prevOdometer: number | null, odometer: number | null, liters: number): number | null {
  if (prevOdometer === null || odometer === null || liters <= 0 || odometer <= prevOdometer) return null
  return round2((odometer - prevOdometer) / liters)
}

/** ¿Toca servicio ya (por fecha o por kilometraje)? */
export function serviceDue(next: { date: Date | null; odometer: number | null }, current: { today?: Date; odometer: number }, warnDays = 15, warnKm = 500): boolean {
  if (next.date && expiryStatus(next.date, current.today ?? new Date(), warnDays) !== "ok") return true
  if (next.odometer !== null && current.odometer >= next.odometer - warnKm) return true
  return false
}

/** Rango [inicio, fin) de un mes «YYYY-MM» (UTC); si no es válido, el mes actual. */
export function monthRange(month: string | undefined, now = new Date()): { label: string; start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "") ?? /^(\d{4})-(\d{2})$/.exec(now.toISOString().slice(0, 7))!
  const y = Number(m[1])
  const mo = Number(m[2])
  return { label: `${m[1]}-${m[2]}`, start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) }
}

/** Suma por clave de una lista de movimientos. */
export function groupSum<T>(rows: T[], key: (r: T) => string, amount: (r: T) => number): { key: string; total: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) map.set(key(r), round2((map.get(key(r)) ?? 0) + amount(r)))
  return [...map.entries()].map(([k, total]) => ({ key: k, total })).sort((a, b) => b.total - a.total)
}

export function balanceOf(income: number, expenses: number) {
  return round2(income - expenses)
}
