import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"
import { acceptsDonations, campaignProgress, isCampaignKind, isCampaignStatus, remainingToGoal, type CampaignKind, type CampaignStatus } from "@/lib/finance/campaign-rules"

// Campañas de donativos. Cualquier creyente ve las abiertas (con su avance, nunca quién
// dio); tesorería (`finance.manage`) las abre, edita, pausa y cierra. El monto reunido
// es la suma de los ingresos ligados a la campaña: una sola fuente de verdad con Finanzas.

const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? 0 : Number(d.toString()))
const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const toDate = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export interface CampaignDto {
  id: string
  name: string
  description: string | null
  kind: CampaignKind
  goalAmount: number | null
  raised: number
  donors: number
  progress: number | null
  remaining: number | null
  imageUrl: string | null
  startsAt: string | null
  endsAt: string | null
  status: CampaignStatus
  isPublic: boolean
  /** ¿Recibe aportaciones hoy? (activa y dentro de su vigencia). */
  open: boolean
}

type Row = {
  id: string
  name: string
  description: string | null
  kind: string
  goalAmount: { toString(): string } | null
  imageUrl: string | null
  startsAt: Date | null
  endsAt: Date | null
  status: string
  isPublic: boolean
}

async function totals(organizationId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { raised: number; donors: number }>()
  const [sums, donors] = await Promise.all([
    prisma.income.groupBy({ by: ["campaignId"], where: { organizationId, campaignId: { in: ids } }, _sum: { amount: true } }),
    prisma.donation.groupBy({ by: ["campaignId"], where: { organizationId, campaignId: { in: ids }, status: "paid" }, _count: { _all: true } }),
  ])
  const out = new Map<string, { raised: number; donors: number }>()
  for (const id of ids) out.set(id, { raised: 0, donors: 0 })
  for (const s of sums) if (s.campaignId) out.get(s.campaignId)!.raised = Math.round(num(s._sum.amount) * 100) / 100
  for (const d of donors) if (d.campaignId) out.get(d.campaignId)!.donors = d._count._all
  return out
}

function dto(r: Row, t: { raised: number; donors: number }): CampaignDto {
  const goal = r.goalAmount === null ? null : num(r.goalAmount)
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    kind: isCampaignKind(r.kind) ? r.kind : "project",
    goalAmount: goal,
    raised: t.raised,
    donors: t.donors,
    progress: campaignProgress(t.raised, goal),
    remaining: remainingToGoal(t.raised, goal),
    imageUrl: r.imageUrl,
    startsAt: ymd(r.startsAt),
    endsAt: ymd(r.endsAt),
    status: isCampaignStatus(r.status) ? r.status : "active",
    isPublic: r.isPublic,
    open: acceptsDonations(r),
  }
}

/** Campañas que hoy reciben aportaciones (lo que ve cualquier creyente). */
export async function listOpenCampaigns(organizationId: string, opts: { publicOnly?: boolean } = {}): Promise<CampaignDto[]> {
  const rows = await prisma.donationCampaign.findMany({
    where: { organizationId, status: "active", ...(opts.publicOnly ? { isPublic: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
  const open = rows.filter((r) => acceptsDonations(r))
  const t = await totals(organizationId, open.map((r) => r.id))
  return open.map((r) => dto(r, t.get(r.id)!))
}

/** Todas las campañas (tesorería). */
export async function listAllCampaigns(actor: Actor): Promise<CampaignDto[]> {
  if (!actor.canViewFinance && !actor.canManageFinance) throw new CrudError("No tienes permiso para ver las campañas", 403)
  const rows = await prisma.donationCampaign.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  })
  const t = await totals(actor.organizationId, rows.map((r) => r.id))
  return rows.map((r) => dto(r, t.get(r.id)!))
}

export async function saveCampaign(actor: Actor, id: string | null, input: Record<string, unknown>) {
  if (!actor.canManageFinance) throw new CrudError("No tienes permiso para gestionar campañas", 403)
  const name = text(input.name, 120)
  if (!name) throw new CrudError("Ponle un nombre a la campaña", 400, "name")
  const goalRaw = input.goalAmount === "" || input.goalAmount === null || input.goalAmount === undefined ? null : Number(input.goalAmount)
  if (goalRaw !== null && (!Number.isFinite(goalRaw) || goalRaw <= 0 || goalRaw > 1_000_000_000)) throw new CrudError("La meta debe ser un monto mayor a cero", 400, "goalAmount")
  const startsAt = toDate(input.startsAt)
  const endsAt = toDate(input.endsAt)
  if (startsAt && endsAt && endsAt < startsAt) throw new CrudError("La fecha final debe ser posterior a la inicial", 400, "endsAt")
  const data = {
    name,
    description: text(input.description, 4000),
    kind: isCampaignKind(input.kind) ? input.kind : "project",
    goalAmount: goalRaw,
    imageUrl: text(input.imageUrl, 500),
    startsAt,
    endsAt,
    isPublic: input.isPublic !== false,
  }
  if (id) {
    const r = await prisma.donationCampaign.updateMany({ where: { id, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Campaña no encontrada", 404)
    return { id }
  }
  const row = await prisma.donationCampaign.create({ data: { ...data, organizationId: actor.organizationId } })
  return { id: row.id }
}

export async function setCampaignStatus(actor: Actor, id: string, status: unknown) {
  if (!actor.canManageFinance) throw new CrudError("No tienes permiso para gestionar campañas", 403)
  if (!isCampaignStatus(status)) throw new CrudError("Estado inválido", 400, "status")
  const r = await prisma.donationCampaign.updateMany({ where: { id, organizationId: actor.organizationId }, data: { status } })
  if (r.count === 0) throw new CrudError("Campaña no encontrada", 404)
  return { ok: true }
}

/** Valida que una campaña exista en la iglesia y reciba aportaciones; devuelve su id y nombre. */
export async function openCampaignOrThrow(organizationId: string, raw: unknown): Promise<{ id: string; name: string } | null> {
  const id = text(raw, 40)
  if (!id) return null
  const c = await prisma.donationCampaign.findFirst({ where: { id, organizationId }, select: { id: true, name: true, status: true, startsAt: true, endsAt: true } })
  if (!c) throw new CrudError("La campaña no existe", 400, "campaignId")
  if (!acceptsDonations(c)) throw new CrudError("Esa campaña ya no recibe aportaciones", 409, "campaignId")
  return { id: c.id, name: c.name }
}
