import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import { isValidDay, isValidTime } from "@/lib/cells/rules"
import {
  CATEGORIES,
  isGatheringKind,
  newExceedsTotal,
  parseCount,
  summarize,
  totalAttendance,
  type Counts,
  type GatheringKindKey,
} from "@/lib/gatherings/rules"

// Reuniones generales (servicios) y de jóvenes: horarios, tema, quién compartió,
// asistencia por categoría y ministerios en servicio.
//
//  - Registrar y configurar: permiso `gatherings.manage` (secretaría, ujieres…).
//  - Ver asistencia y reportes: `gatherings.view`.
//  - Cualquier integrante de la iglesia ve el horario y los temas (sin cifras).

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const toDate = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Alcance de lectura: toda la iglesia con permiso global; si no, solo los grupos
 * (Jóvenes, Varones…) que la persona lidera. null = sin restricción.
 */
async function viewScope(actor: Actor): Promise<string[] | null> {
  if (actor.canViewGatherings || actor.canManageGatherings) return null
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const rows = memberId
    ? await prisma.ministryMember.findMany({
        where: { organizationId: actor.organizationId, memberId, isActive: true, role: { in: ["leader", "assistant"] }, ministry: { isActive: true, kind: { in: ["youth", "group"] } } },
        select: { ministryId: true },
      })
    : []
  if (rows.length === 0) throw new CrudError("No tienes permiso para ver la asistencia de las reuniones", 403)
  return rows.map((r) => r.ministryId)
}
function assertManage(actor: Actor) {
  if (!actor.canManageGatherings) throw new CrudError("No tienes permiso para registrar reuniones", 403)
}

/** Permiso global o liderar el grupo dueño (Jóvenes, Varones…): alcance por relación. */
async function assertManageFor(actor: Actor, ministryId: string | null) {
  if (actor.canManageGatherings) return
  if (ministryId) {
    try {
      if ((await ministryAccess(actor, ministryId)).canManage) return
    } catch {
      /* sin acceso */
    }
  }
  throw new CrudError("No tienes permiso para registrar reuniones", 403)
}

/** Grupos que pueden tener sus propias reuniones: Jóvenes, Varones, Mujeres… */
export async function listGroups(actor: Actor) {
  const rows = await prisma.ministry.findMany({
    where: { organizationId: actor.organizationId, isActive: true, kind: { in: ["youth", "group"] } },
    select: { id: true, name: true, kind: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return rows
}

async function resolveGroup(organizationId: string, raw: unknown): Promise<{ id: string; kind: GatheringKindKey } | null> {
  const id = text(raw, 40)
  if (!id) return null
  const m = await prisma.ministry.findFirst({ where: { id, organizationId }, select: { id: true, kind: true } })
  if (!m) throw new CrudError("Grupo no válido", 400, "ministryId")
  return { id: m.id, kind: m.kind === "youth" ? "youth" : "general" }
}

// ── Horarios ─────────────────────────────────────────────────────────────────

export interface SeriesDto {
  id: string
  name: string
  ministryId: string | null
  groupName: string | null
  kind: GatheringKindKey
  dayOfWeek: number
  startTime: string
  endTime: string | null
  modality: string
  isPublic: boolean
  description: string | null
  isActive: boolean
}

export async function listSeries(actor: Actor): Promise<SeriesDto[]> {
  const rows = await prisma.gatheringSeries.findMany({
    where: { organizationId: actor.organizationId },
    include: { ownerMinistry: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ministryId: r.ministryId,
    groupName: r.ownerMinistry?.name ?? null,
    kind: r.kind,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    modality: r.modality,
    isPublic: r.isPublic,
    description: r.description,
    isActive: r.isActive,
  }))
}

export async function saveSeries(actor: Actor, id: string | null, input: Record<string, unknown>) {
  const group = await resolveGroup(actor.organizationId, input.ministryId)
  await assertManageFor(actor, group?.id ?? null)
  const name = text(input.name, 80)
  if (!name) throw new CrudError("Escribe el nombre del horario", 400, "name")
  const day = Number(input.dayOfWeek)
  if (!isValidDay(day)) throw new CrudError("Elige el día", 400, "dayOfWeek")
  if (!isValidTime(input.startTime)) throw new CrudError("Hora inválida (HH:MM)", 400, "startTime")
  const kind: GatheringKindKey = group ? group.kind : isGatheringKind(input.kind) ? input.kind : "general"
  const endTime = input.endTime === null || input.endTime === "" || input.endTime === undefined ? null : isValidTime(input.endTime) ? input.endTime : "invalid"
  if (endTime === "invalid") throw new CrudError("Hora final inválida (HH:MM)", 400, "endTime")
  const modality = input.modality === "online" || input.modality === "both" ? input.modality : "in_person"
  const data = {
    name,
    kind,
    ministryId: group?.id ?? null,
    dayOfWeek: day,
    startTime: input.startTime,
    endTime,
    modality,
    isPublic: input.isPublic !== false,
    description: text(input.description, 200),
    ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
  }
  try {
    if (id) {
      const r = await prisma.gatheringSeries.updateMany({ where: { id, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Horario no encontrado", 404)
      return { id }
    }
    const row = await prisma.gatheringSeries.create({ data: { ...data, organizationId: actor.organizationId } })
    return { id: row.id }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
      throw new CrudError("Ya existe un horario con ese nombre", 409, "name")
    }
    throw err
  }
}

// ── Reuniones ────────────────────────────────────────────────────────────────

export interface GatheringDto {
  id: string
  ministryId: string | null
  groupName: string | null
  seriesId: string | null
  seriesName: string | null
  kind: GatheringKindKey
  date: string
  startTime: string | null
  topic: string | null
  speakerMemberId: string | null
  speakerName: string | null
  imageUrl: string | null
  notes: string | null
  evidenceUrls: string[]
  counts: Counts
  total: number
  ministryIds: string[]
  ministryNames: string[]
}

const include = {
  series: { select: { name: true, startTime: true } },
  ownerMinistry: { select: { name: true } },
  speaker: { select: { fullName: true } },
  ministries: { select: { ministryId: true, ministry: { select: { name: true } } } },
} as const
type Row = Awaited<ReturnType<typeof prisma.gathering.findFirstOrThrow<{ include: typeof include }>>>

const evidence = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^(https?:\/\/|\/)/.test(x)).slice(0, 12) : []

function dto(g: Row): GatheringDto {
  const counts: Counts = { men: g.menCount, women: g.womenCount, youth: g.youthCount, kids: g.kidsCount, new: g.newCount }
  return {
    id: g.id,
    ministryId: g.ministryId,
    groupName: g.ownerMinistry?.name ?? null,
    seriesId: g.seriesId,
    seriesName: g.series?.name ?? null,
    kind: g.kind,
    date: ymd(g.date),
    startTime: g.startTime ?? g.series?.startTime ?? null,
    topic: g.topic,
    speakerMemberId: g.speakerMemberId,
    speakerName: g.speaker?.fullName ?? g.speakerName,
    imageUrl: g.imageUrl,
    notes: g.notes,
    evidenceUrls: evidence(g.evidenceUrls),
    counts,
    total: totalAttendance(counts),
    ministryIds: g.ministries.map((m) => m.ministryId),
    ministryNames: g.ministries.map((m) => m.ministry.name),
  }
}

function monthRange(month: string | undefined) {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "") ?? /^(\d{4})-(\d{2})$/.exec(ymd(new Date()).slice(0, 7))!
  return {
    label: `${m[1]}-${m[2]}`,
    start: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)),
    end: new Date(Date.UTC(Number(m[1]), Number(m[2]), 1)),
  }
}

export async function listGatherings(actor: Actor, filter: { month?: string; kind?: string; ministryId?: string }) {
  const scope = await viewScope(actor)
  const range = monthRange(filter.month)
  const rows = await prisma.gathering.findMany({
    where: {
      organizationId: actor.organizationId,
      date: { gte: range.start, lt: range.end },
      ...(isGatheringKind(filter.kind) ? { kind: filter.kind } : {}),
      ...(filter.ministryId ? { ministryId: filter.ministryId } : {}),
      ...(scope ? { ministryId: filter.ministryId && scope.includes(filter.ministryId) ? filter.ministryId : { in: scope } } : {}),
    },
    include,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  })
  const gatherings = rows.map(dto)
  const s = summarize(gatherings.map((g) => ({ date: g.date, counts: g.counts })))
  return { month: range.label, gatherings, summary: { ...s, count: gatherings.length } }
}

export async function getGathering(actor: Actor, id: string) {
  const scope = await viewScope(actor)
  const g = await prisma.gathering.findFirst({ where: { id, organizationId: actor.organizationId }, include })
  if (!g || (scope && !(g.ministryId && scope.includes(g.ministryId)))) throw new CrudError("Reunión no encontrada", 404)
  return dto(g)
}

export interface GatheringInput {
  ministryId?: unknown
  seriesId?: unknown
  kind?: unknown
  date?: unknown
  startTime?: unknown
  topic?: unknown
  speakerName?: unknown
  speakerMemberId?: unknown
  imageUrl?: unknown
  notes?: unknown
  evidenceUrls?: unknown
  counts?: unknown
  ministryIds?: unknown
}

export async function saveGathering(actor: Actor, id: string | null, input: GatheringInput) {
  let group = await resolveGroup(actor.organizationId, input.ministryId)
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha de la reunión", 400, "date")
  if (date.getTime() > Date.now() + 86_400_000) throw new CrudError("No se puede registrar la asistencia de una fecha futura", 400, "date")

  let seriesId: string | null = null
  let kind: GatheringKindKey = isGatheringKind(input.kind) ? input.kind : "general"
  const rawSeries = text(input.seriesId, 40)
  if (rawSeries) {
    const series = await prisma.gatheringSeries.findFirst({ where: { id: rawSeries, organizationId: actor.organizationId } })
    if (!series) throw new CrudError("Horario no válido", 400, "seriesId")
    seriesId = series.id
    kind = series.kind
    if (!group && series.ministryId) group = await resolveGroup(actor.organizationId, series.ministryId)
  }
  if (group) kind = group.kind
  await assertManageFor(actor, group?.id ?? null)
  if (input.startTime && !isValidTime(input.startTime)) throw new CrudError("Hora inválida (HH:MM)", 400, "startTime")

  const raw = (input.counts ?? {}) as Record<string, unknown>
  const counts = {} as Counts
  for (const k of CATEGORIES) {
    const n = parseCount(raw[k])
    if (n === null) throw new CrudError("Las cantidades deben ser números enteros, 0 o más", 400, "counts")
    counts[k] = n
  }
  if (newExceedsTotal(counts)) throw new CrudError("Los nuevos no pueden ser más que la asistencia total", 400, "counts")

  const imageUrl = text(input.imageUrl, 500)
  const speakerMemberId = text(input.speakerMemberId, 40)
  if (speakerMemberId) {
    const ok = await prisma.member.findFirst({ where: { id: speakerMemberId, organizationId: actor.organizationId }, select: { id: true } })
    if (!ok) throw new CrudError("Quien compartió no es un creyente de esta iglesia", 400, "speakerMemberId")
  }
  const ministryIds = Array.isArray(input.ministryIds)
    ? [...new Set(input.ministryIds.filter((x): x is string => typeof x === "string"))].slice(0, 40)
    : []
  if (ministryIds.length > 0) {
    const n = await prisma.ministry.count({ where: { organizationId: actor.organizationId, id: { in: ministryIds } } })
    if (n !== ministryIds.length) throw new CrudError("Ministerio no válido", 400, "ministryIds")
  }

  const data = {
    seriesId,
    ministryId: group?.id ?? null,
    kind,
    date,
    startTime: input.startTime ? String(input.startTime) : null,
    topic: text(input.topic, 200),
    speakerMemberId,
    speakerName: text(input.speakerName, 150),
    imageUrl,
    notes: text(input.notes, 2000),
    evidenceUrls: evidence(input.evidenceUrls),
    menCount: counts.men,
    womenCount: counts.women,
    youthCount: counts.youth,
    kidsCount: counts.kids,
    newCount: counts.new,
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      let gid = id
      if (id) {
        const r = await tx.gathering.updateMany({ where: { id, organizationId: actor.organizationId }, data })
        if (r.count === 0) throw new CrudError("Reunión no encontrada", 404)
      } else {
        const row = await tx.gathering.create({
          data: { ...data, organizationId: actor.organizationId, createdByUserId: actor.userId },
          select: { id: true },
        })
        gid = row.id
      }
      await tx.gatheringMinistry.deleteMany({ where: { gatheringId: gid! } })
      if (ministryIds.length > 0) {
        await tx.gatheringMinistry.createMany({
          data: ministryIds.map((ministryId) => ({ organizationId: actor.organizationId, gatheringId: gid!, ministryId })),
        })
      }
      return gid!
    })
    return { id: saved }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
      throw new CrudError("Ya hay una reunión registrada de ese horario en esa fecha", 409, "date")
    }
    throw err
  }
}

export async function deleteGathering(actor: Actor, id: string) {
  const g = await prisma.gathering.findFirst({ where: { id, organizationId: actor.organizationId }, select: { ministryId: true } })
  if (!g) throw new CrudError("Reunión no encontrada", 404)
  await assertManageFor(actor, g.ministryId)
  const r = await prisma.gathering.deleteMany({ where: { id, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Reunión no encontrada", 404)
  return { ok: true }
}

/** Cifras que ya existen en el sistema para esa fecha: ayudan a capturar sin repetir. */
export async function getSuggestions(actor: Actor, dateRaw: string) {
  assertManage(actor)
  const date = toDate(dateRaw)
  if (!date) throw new CrudError("Fecha inválida", 400, "date")
  const [kids, newcomers, ministries] = await Promise.all([
    prisma.kidsAttendance.count({ where: { organizationId: actor.organizationId, session: { date, kind: "service" } } }),
    prisma.consolidationCase.count({ where: { organizationId: actor.organizationId, visitedAt: date } }),
    prisma.ministry.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ])
  return { kids, newcomers, ministries }
}

// ── Reporte mensual ──────────────────────────────────────────────────────────

export async function getReport(actor: Actor, month: string | undefined, kind: string | undefined, ministryId?: string) {
  const data = await listGatherings(actor, { month, kind, ministryId })
  // Por horario: promedio y total, para comparar «Domingo 10:00» con «Domingo 12:30».
  const bySeries = new Map<string, { name: string; rows: { date: string; counts: Counts }[] }>()
  for (const g of data.gatherings) {
    const key = g.seriesId ?? "sin-horario"
    const entry = bySeries.get(key) ?? { name: g.seriesName ?? "Sin horario", rows: [] }
    entry.rows.push({ date: g.date, counts: g.counts })
    bySeries.set(key, entry)
  }
  return {
    ...data,
    bySeries: [...bySeries.entries()].map(([id, v]) => ({ id, name: v.name, ...summarize(v.rows), count: v.rows.length })),
  }
}

// ── Vista para toda la iglesia ───────────────────────────────────────────────

export async function getPublicOverview(actor: Actor) {
  const [series, recent] = await Promise.all([
    prisma.gatheringSeries.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.gathering.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: [{ date: "desc" }],
      take: 6,
      include: { series: { select: { name: true } }, speaker: { select: { fullName: true } }, ownerMinistry: { select: { name: true } } },
    }),
  ])
  return {
    series: series.map((s) => ({ id: s.id, name: s.name, kind: s.kind, dayOfWeek: s.dayOfWeek, startTime: s.startTime })),
    recent: recent.map((g) => ({
      id: g.id,
      date: ymd(g.date),
      kind: g.kind,
      seriesName: g.series?.name ?? null,
      groupName: g.ownerMinistry?.name ?? null,
      topic: g.topic,
      speakerName: g.speaker?.fullName ?? g.speakerName,
      imageUrl: g.imageUrl,
    })),
  }
}
