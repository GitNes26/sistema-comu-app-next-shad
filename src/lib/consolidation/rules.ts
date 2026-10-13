// Reglas puras de Consolidación (sin base de datos): estados, transiciones y
// vencimiento del seguimiento. Las usan servidor, interfaz y pruebas.

export const CASE_STATUSES = ["received", "following", "channeled", "closed"] as const
export type CaseStatusKey = (typeof CASE_STATUSES)[number]

export const CASE_STATUS_LABEL: Record<CaseStatusKey, string> = {
  received: "Recibido",
  following: "En seguimiento",
  channeled: "Canalizado",
  closed: "Cerrado",
}

export const OUTCOMES = ["cell", "meeting", "none"] as const
export type OutcomeKey = (typeof OUTCOMES)[number]
export const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  cell: "A una célula",
  meeting: "A otra reunión",
  none: "No continúa",
}

export const CHANNELS = ["call", "message", "visit", "in_person"] as const
export type ChannelKey = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<ChannelKey, string> = {
  call: "Llamada",
  message: "Mensaje",
  visit: "Visita",
  in_person: "En persona",
}

export const INTERESTS = ["yes", "maybe", "no"] as const
export type InterestKey = (typeof INTERESTS)[number]
export const INTEREST_LABEL: Record<InterestKey, string> = {
  yes: "Quiere seguir asistiendo",
  maybe: "Lo está pensando",
  no: "No le interesa",
}

export const isCaseStatus = (v: unknown): v is CaseStatusKey => CASE_STATUSES.includes(v as CaseStatusKey)
export const isOutcome = (v: unknown): v is OutcomeKey => OUTCOMES.includes(v as OutcomeKey)
export const isChannel = (v: unknown): v is ChannelKey => CHANNELS.includes(v as ChannelKey)
export const isInterest = (v: unknown): v is InterestKey => INTERESTS.includes(v as InterestKey)

/** Un caso cerrado o canalizado solo se reabre por quien gestiona; el resto avanza libremente. */
export function canTransition(from: CaseStatusKey, to: CaseStatusKey, canManage: boolean): boolean {
  if (from === to) return true
  if (from === "closed" || from === "channeled") return canManage
  return true
}

/** Un caso canalizado necesita saber a dónde; uno cerrado, el motivo (nota). */
export function outcomeRequired(status: CaseStatusKey): boolean {
  return status === "channeled"
}

/** El seguimiento está vencido si ya pasó la fecha del próximo contacto (o no hay ninguno tras 3 días). */
export function isFollowUpOverdue(
  c: { status: CaseStatusKey; lastContactAt: Date | null; nextContactAt: Date | null; createdAt: Date },
  now = new Date()
): boolean {
  if (c.status === "channeled" || c.status === "closed") return false
  if (c.nextContactAt) return c.nextContactAt.getTime() < now.getTime()
  const since = c.lastContactAt ?? c.createdAt
  return now.getTime() - since.getTime() > 3 * 86_400_000
}

/** Normaliza un teléfono para detectar duplicados (solo dígitos, últimos 10). */
export function normalizePhone(v: unknown): string | null {
  const digits = typeof v === "string" ? v.replace(/\D/g, "") : ""
  return digits.length >= 7 ? digits.slice(-10) : null
}
