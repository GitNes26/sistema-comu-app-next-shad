// Reglas puras de las campañas de donativos (ComuniDAR y proyectos): estados, vigencia
// y avance. Sin Prisma; las usan el servidor, el cliente y las pruebas.

export const CAMPAIGN_KINDS = {
  building: "Construcción",
  project: "Proyecto",
  event: "Evento",
  general: "General",
} as const
export type CampaignKind = keyof typeof CAMPAIGN_KINDS
export const isCampaignKind = (v: unknown): v is CampaignKind => typeof v === "string" && v in CAMPAIGN_KINDS

export const CAMPAIGN_STATUS = { active: "Activa", paused: "En pausa", closed: "Cerrada" } as const
export type CampaignStatus = keyof typeof CAMPAIGN_STATUS
export const isCampaignStatus = (v: unknown): v is CampaignStatus => typeof v === "string" && v in CAMPAIGN_STATUS

export interface CampaignWindow {
  status: string
  startsAt: Date | null
  endsAt: Date | null
}

/** ¿Recibe aportaciones ahora? Activa y dentro de su vigencia (fechas inclusivas, en UTC). */
export function acceptsDonations(c: CampaignWindow, now = new Date()): boolean {
  if (c.status !== "active") return false
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (c.startsAt && day < c.startsAt.getTime()) return false
  if (c.endsAt && day > c.endsAt.getTime()) return false
  return true
}

/** Porcentaje 0–100 de la meta; null si no hay meta. Pasarse de la meta cuenta 100. */
export function campaignProgress(raised: number, goal: number | null): number | null {
  if (goal === null || goal <= 0) return null
  return Math.min(100, Math.round((raised / goal) * 1000) / 10)
}

/** Lo que falta para la meta (nunca negativo); null si no hay meta. */
export function remainingToGoal(raised: number, goal: number | null): number | null {
  if (goal === null || goal <= 0) return null
  return Math.max(0, Math.round((goal - raised) * 100) / 100)
}
