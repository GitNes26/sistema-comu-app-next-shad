// Reglas puras de Ministerios (sin Prisma): etiquetas, transiciones y resúmenes.

export const MINISTRY_ROLES = ["leader", "assistant", "servant"] as const
export type MinistryRoleKey = (typeof MINISTRY_ROLES)[number]

export const MINISTRY_ROLE_LABEL: Record<MinistryRoleKey, string> = {
  leader: "Líder",
  assistant: "Apoyo",
  servant: "Servidor",
}

export const MEETING_KINDS = ["internal", "rehearsal", "service"] as const
export type MeetingKindKey = (typeof MEETING_KINDS)[number]

export const MEETING_KIND_LABEL: Record<MeetingKindKey, string> = {
  internal: "Junta",
  rehearsal: "Ensayo",
  service: "Servicio",
}

export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const
export type AttendanceStatusKey = (typeof ATTENDANCE_STATUSES)[number]

export const ATTENDANCE_LABEL: Record<AttendanceStatusKey, string> = {
  present: "Asistió",
  absent: "Faltó",
  excused: "Justificado",
}

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "delivered", "cancelled"] as const
export type RequestStatusKey = (typeof REQUEST_STATUSES)[number]

export const REQUEST_STATUS_LABEL: Record<RequestStatusKey, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  delivered: "Entregada",
  cancelled: "Cancelada",
}

/** Quién decide: `admin` = permiso global de ministerios; `requester` = quien la pidió. */
const TRANSITIONS: Record<RequestStatusKey, { to: RequestStatusKey; by: "admin" | "requester" }[]> = {
  pending: [
    { to: "approved", by: "admin" },
    { to: "rejected", by: "admin" },
    { to: "cancelled", by: "requester" },
  ],
  approved: [
    { to: "delivered", by: "admin" },
    { to: "cancelled", by: "admin" },
  ],
  rejected: [],
  delivered: [],
  cancelled: [],
}

export function canTransitionRequest(from: RequestStatusKey, to: RequestStatusKey, actor: "admin" | "requester"): boolean {
  return TRANSITIONS[from].some((t) => t.to === to && t.by === actor)
}

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  excused: number
  /** Porcentaje de asistencia sobre lo registrado (justificados no cuentan como falta). */
  rate: number | null
}

export function summarizeAttendance(statuses: readonly AttendanceStatusKey[]): AttendanceSummary {
  const present = statuses.filter((s) => s === "present").length
  const absent = statuses.filter((s) => s === "absent").length
  const excused = statuses.filter((s) => s === "excused").length
  const considered = present + absent
  return {
    total: statuses.length,
    present,
    absent,
    excused,
    rate: considered === 0 ? null : Math.round((present / considered) * 100),
  }
}

/** ¿Poner `parentId` como padre de `id` formaría un ciclo? `parents` mapea id → parentId. */
export function createsCycle(id: string, parentId: string | null, parents: ReadonlyMap<string, string | null>): boolean {
  let cursor: string | null = parentId
  const seen = new Set<string>()
  while (cursor) {
    if (cursor === id) return true
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = parents.get(cursor) ?? null
  }
  return false
}

export function isMinistryRole(v: unknown): v is MinistryRoleKey {
  return typeof v === "string" && (MINISTRY_ROLES as readonly string[]).includes(v)
}
export function isMeetingKind(v: unknown): v is MeetingKindKey {
  return typeof v === "string" && (MEETING_KINDS as readonly string[]).includes(v)
}
export function isAttendanceStatus(v: unknown): v is AttendanceStatusKey {
  return typeof v === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(v)
}
