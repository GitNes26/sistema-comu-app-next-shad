import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { ministryAccess, type Actor } from "@/lib/ministries/server"

// Asistencia de los servidores de un ministerio a las reuniones generales en que su
// ministerio estuvo en servicio («GatheringMinistry»).
//
//  - Pasar lista: líder o apoyo del ministerio, o `gatherings.manage`.
//  - Ver: cualquier integrante del ministerio, o quien ve los ministerios/reuniones.
//  - Cada servidor ve su propio estado en la lista de reuniones de su ministerio.

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const STATUSES = ["present", "absent", "excused"] as const
export type ServiceStatus = (typeof STATUSES)[number]
const isStatus = (v: unknown): v is ServiceStatus => typeof v === "string" && (STATUSES as readonly string[]).includes(v)

async function serviceContext(actor: Actor, gatheringId: string, ministryId: string) {
  const [access, gathering, served] = await Promise.all([
    ministryAccess(actor, ministryId),
    prisma.gathering.findFirst({
      where: { id: gatheringId, organizationId: actor.organizationId },
      select: { id: true, date: true, topic: true, kind: true, series: { select: { name: true } }, ownerMinistry: { select: { name: true } } },
    }),
    prisma.gatheringMinistry.findFirst({ where: { gatheringId, ministryId, organizationId: actor.organizationId }, select: { id: true } }),
  ])
  if (!gathering) throw new CrudError("Reunión no encontrada", 404)
  if (!served) throw new CrudError("Este ministerio no estuvo en servicio en esa reunión", 409)
  const canView = access.canView || Boolean(actor.canViewGatherings || actor.canManageGatherings)
  if (!canView) throw new CrudError("Ministerio no encontrado", 404)
  const canEdit = access.canTakeAttendance || Boolean(actor.canManageGatherings)
  return { access, gathering, canEdit }
}

export interface ServiceSheetDto {
  gathering: { id: string; date: string; label: string }
  ministry: { id: string; name: string }
  canEdit: boolean
  people: { memberId: string; fullName: string; role: "leader" | "assistant" | "servant"; positionTitle: string | null; status: ServiceStatus | null; note: string | null }[]
  summary: { present: number; absent: number; excused: number; unmarked: number }
}

export async function getServiceSheet(actor: Actor, gatheringId: string, ministryId: string): Promise<ServiceSheetDto> {
  const { access, gathering, canEdit } = await serviceContext(actor, gatheringId, ministryId)
  const [roster, marks] = await Promise.all([
    prisma.ministryMember.findMany({
      where: { organizationId: actor.organizationId, ministryId, isActive: true, member: { isActive: true } },
      select: { memberId: true, role: true, positionTitle: true, member: { select: { fullName: true } } },
    }),
    prisma.gatheringServer.findMany({ where: { gatheringId, ministryId }, select: { memberId: true, status: true, note: true } }),
  ])
  const byMember = new Map(marks.map((m) => [m.memberId, m]))
  const order = { leader: 0, assistant: 1, servant: 2 } as const
  const people = roster
    .map((r) => ({
      memberId: r.memberId,
      fullName: r.member.fullName,
      role: r.role,
      positionTitle: r.positionTitle,
      status: (byMember.get(r.memberId)?.status as ServiceStatus | undefined) ?? null,
      note: byMember.get(r.memberId)?.note ?? null,
    }))
    .sort((a, b) => order[a.role] - order[b.role] || a.fullName.localeCompare(b.fullName, "es"))
  const count = (s: ServiceStatus | null) => people.filter((p) => p.status === s).length
  void access
  return {
    gathering: { id: gathering.id, date: ymd(gathering.date), label: gathering.series?.name ?? gathering.ownerMinistry?.name ?? gathering.topic ?? "Reunión" },
    ministry: { id: ministryId, name: access.ministry.name },
    canEdit,
    people,
    summary: { present: count("present"), absent: count("absent"), excused: count("excused"), unmarked: count(null) },
  }
}

export async function saveServiceSheet(actor: Actor, gatheringId: string, ministryId: string, input: { records?: unknown }) {
  const { canEdit } = await serviceContext(actor, gatheringId, ministryId)
  if (!canEdit) throw new CrudError("No tienes permiso para pasar lista de este ministerio", 403)
  if (!Array.isArray(input.records)) throw new CrudError("Envía la lista de servidores", 400, "records")
  const records = input.records.slice(0, 500).map((r) => (r ?? {}) as { memberId?: unknown; status?: unknown; note?: unknown })
  const roster = await prisma.ministryMember.findMany({
    where: { organizationId: actor.organizationId, ministryId, isActive: true },
    select: { memberId: true },
  })
  const allowed = new Set(roster.map((r) => r.memberId))
  for (const r of records) {
    if (typeof r.memberId !== "string" || !allowed.has(r.memberId)) throw new CrudError("Hay una persona que no sirve en este ministerio", 400, "records")
    if (r.status !== null && r.status !== undefined && !isStatus(r.status)) throw new CrudError("Estado de asistencia inválido", 400, "records")
  }
  await prisma.$transaction(async (tx) => {
    for (const r of records) {
      const memberId = r.memberId as string
      if (r.status === null || r.status === undefined) {
        await tx.gatheringServer.deleteMany({ where: { gatheringId, ministryId, memberId } })
        continue
      }
      const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 200) : null
      await tx.gatheringServer.upsert({
        where: { gatheringId_ministryId_memberId: { gatheringId, ministryId, memberId } },
        update: { status: r.status as ServiceStatus, note, markedByUserId: actor.userId, markedAt: new Date() },
        create: { organizationId: actor.organizationId, gatheringId, ministryId, memberId, status: r.status as ServiceStatus, note, markedByUserId: actor.userId },
      })
    }
  })
  return { ok: true }
}

export interface MinistryServiceRowDto {
  gatheringId: string
  date: string
  label: string
  topic: string | null
  /** Integrantes activos hoy (referencia). */
  roster: number
  present: number
  absent: number
  excused: number
  unmarked: number
  /** Estado de la persona que consulta, si sirve en el ministerio. */
  mine: ServiceStatus | null
  upcoming: boolean
}

/** Reuniones generales recientes en que el ministerio estuvo en servicio. */
export async function listMinistryServices(actor: Actor, ministryId: string): Promise<{ canEdit: boolean; rows: MinistryServiceRowDto[] }> {
  const access = await ministryAccess(actor, ministryId)
  const canView = access.canView || Boolean(actor.canViewGatherings || actor.canManageGatherings)
  if (!canView) throw new CrudError("Ministerio no encontrado", 404)
  const now = new Date()
  const from = new Date(now.getTime() - 120 * 86_400_000)
  const to = new Date(now.getTime() + 14 * 86_400_000)
  const [served, rosterCount] = await Promise.all([
    prisma.gatheringMinistry.findMany({
      where: { ministryId, organizationId: actor.organizationId, gathering: { date: { gte: from, lte: to } } },
      select: {
        gatheringId: true,
        gathering: { select: { date: true, topic: true, series: { select: { name: true } }, ownerMinistry: { select: { name: true } }, servers: { where: { ministryId }, select: { memberId: true, status: true } } } },
      },
    }),
    prisma.ministryMember.count({ where: { organizationId: actor.organizationId, ministryId, isActive: true } }),
  ])
  const mineId = access.memberId
  const today = ymd(now)
  const rows = served
    .map((s): MinistryServiceRowDto => {
      const marks = s.gathering.servers
      const c = (st: ServiceStatus) => marks.filter((m) => m.status === st).length
      const date = ymd(s.gathering.date)
      return {
        gatheringId: s.gatheringId,
        date,
        label: s.gathering.series?.name ?? s.gathering.ownerMinistry?.name ?? s.gathering.topic ?? "Reunión",
        topic: s.gathering.topic,
        roster: rosterCount,
        present: c("present"),
        absent: c("absent"),
        excused: c("excused"),
        unmarked: Math.max(0, rosterCount - marks.length),
        mine: (mineId ? (marks.find((m) => m.memberId === mineId)?.status as ServiceStatus | undefined) : undefined) ?? null,
        upcoming: date > today,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  return { canEdit: access.canTakeAttendance || Boolean(actor.canManageGatherings), rows }
}
