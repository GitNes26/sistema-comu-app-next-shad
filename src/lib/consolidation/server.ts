import { prisma } from "@/lib/db"
import { fireAndForget, notifyMembers } from "@/lib/notifications/church"
import { rankByDistance } from "@/lib/cells/geo"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import {
  canTransition,
  isCaseStatus,
  isChannel,
  isFollowUpOverdue,
  isInterest,
  isOutcome,
  normalizePhone,
  outcomeRequired,
  type CaseStatusKey,
  type ChannelKey,
  type InterestKey,
  type OutcomeKey,
} from "@/lib/consolidation/rules"

// Consolidación: seguimiento de quienes llegan por primera vez.
// El ministerio es un `Ministry` con kind = "consolidation".
//
//  - Ver todos los casos: líder, apoyo o permiso global de ministerios.
//  - Un servidor ve y atiende solo los casos que se le asignaron.
//  - Registrar a una persona nueva: cualquier integrante del ministerio.
//  - Asignar a quien da seguimiento y reabrir casos: líder o permiso global.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const coord = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

async function consolidationAccess(actor: Actor, ministryId: string) {
  const access = await ministryAccess(actor, ministryId)
  const ministry = await prisma.ministry.findFirst({
    where: { id: ministryId, organizationId: actor.organizationId },
    select: { kind: true },
  })
  if (!ministry || ministry.kind !== "consolidation" || !access.canView) throw new CrudError("Ministerio no encontrado", 404)
  const seesAll = access.canManage || access.myRole === "assistant" || actor.canViewAll
  return {
    memberId: access.memberId,
    canManage: access.canManage,
    seesAll,
    canRegister: access.myRole !== null || actor.canManageAll,
    isAssistant: access.myRole === "assistant",
  }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CaseDto {
  id: string
  memberId: string
  fullName: string
  phone: string | null
  email: string | null
  imageUrl: string | null
  visitedAt: string
  serviceLabel: string | null
  acceptedChrist: boolean
  status: CaseStatusKey
  assignedMemberId: string | null
  assignedName: string | null
  outcome: OutcomeKey | null
  outcomeNote: string | null
  lastContactAt: string | null
  nextContactAt: string | null
  contactCount: number
  overdue: boolean
  mine: boolean
}

export interface ContactDto {
  id: string
  contactedAt: string
  channel: ChannelKey
  summary: string
  interest: InterestKey | null
  nextContactAt: string | null
  madeByName: string | null
}

export interface CaseDetailDto extends CaseDto {
  notes: string | null
  person: {
    gender: string | null
    birthDate: string | null
    street: string | null
    neighborhood: string | null
    city: string | null
    latitude: number | null
    longitude: number | null
    invitedByName: string | null
    contactSchedule: string | null
  }
  contacts: ContactDto[]
  canManage: boolean
  /** Puede registrar contactos y cambiar el estado (líder, apoyo o la persona asignada). */
  canWork: boolean
}

export interface ConsolidationWorkspaceDto {
  cases: CaseDto[]
  summary: { received: number; following: number; channeled: number; closed: number; unassigned: number; overdue: number }
  followers: { memberId: string; fullName: string; role: string }[]
  access: { canManage: boolean; canRegister: boolean; scope: "all" | "mine" }
}

const caseInclude = {
  member: { select: { fullName: true, phone: true, email: true, imageUrl: true } },
  assignedTo: { select: { fullName: true } },
  contacts: { orderBy: { contactedAt: "desc" as const }, take: 1, select: { contactedAt: true, nextContactAt: true } },
  _count: { select: { contacts: true } },
}
type CaseRow = Awaited<ReturnType<typeof prisma.consolidationCase.findFirstOrThrow<{ include: typeof caseInclude }>>>

function caseDto(row: CaseRow, myMemberId: string | null): CaseDto {
  const last = row.contacts[0] ?? null
  return {
    id: row.id,
    memberId: row.memberId,
    fullName: row.member.fullName,
    phone: row.member.phone,
    email: row.member.email,
    imageUrl: row.member.imageUrl,
    visitedAt: ymd(row.visitedAt),
    serviceLabel: row.serviceLabel,
    acceptedChrist: row.acceptedChrist,
    status: row.status,
    assignedMemberId: row.assignedMemberId,
    assignedName: row.assignedTo?.fullName ?? null,
    outcome: row.outcome,
    outcomeNote: row.outcomeNote,
    lastContactAt: last?.contactedAt.toISOString() ?? null,
    nextContactAt: last?.nextContactAt?.toISOString() ?? null,
    contactCount: row._count.contacts,
    overdue: isFollowUpOverdue({
      status: row.status,
      lastContactAt: last?.contactedAt ?? null,
      nextContactAt: last?.nextContactAt ?? null,
      createdAt: row.createdAt,
    }),
    mine: myMemberId !== null && row.assignedMemberId === myMemberId,
  }
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function listCases(actor: Actor, ministryId: string, filter: { q?: string } = {}): Promise<ConsolidationWorkspaceDto> {
  const a = await consolidationAccess(actor, ministryId)
  const q = filter.q?.trim()
  const rows = await prisma.consolidationCase.findMany({
    where: {
      organizationId: actor.organizationId,
      ministryId,
      ...(a.seesAll ? {} : { assignedMemberId: a.memberId ?? "__none__" }),
      ...(q ? { member: { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] } } : {}),
    },
    include: caseInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  })
  const cases = rows.map((r) => caseDto(r, a.memberId))
  const summary = {
    received: cases.filter((c) => c.status === "received").length,
    following: cases.filter((c) => c.status === "following").length,
    channeled: cases.filter((c) => c.status === "channeled").length,
    closed: cases.filter((c) => c.status === "closed").length,
    unassigned: cases.filter((c) => !c.assignedMemberId && c.status !== "closed" && c.status !== "channeled").length,
    overdue: cases.filter((c) => c.overdue).length,
  }
  const followers = a.canManage
    ? (
        await prisma.ministryMember.findMany({
          where: { organizationId: actor.organizationId, ministryId, isActive: true },
          select: { memberId: true, role: true, member: { select: { fullName: true } } },
          orderBy: { member: { fullName: "asc" } },
        })
      ).map((m) => ({ memberId: m.memberId, fullName: m.member.fullName, role: m.role }))
    : []
  return { cases, summary, followers, access: { canManage: a.canManage, canRegister: a.canRegister, scope: a.seesAll ? "all" : "mine" } }
}

async function loadCase(actor: Actor, caseId: string) {
  const row = await prisma.consolidationCase.findFirst({
    where: { id: caseId, organizationId: actor.organizationId },
    include: caseInclude,
  })
  if (!row) throw new CrudError("Caso no encontrado", 404)
  const a = await consolidationAccess(actor, row.ministryId)
  // 404 y no 403 para lo que no le toca.
  if (!a.seesAll && row.assignedMemberId !== a.memberId) throw new CrudError("Caso no encontrado", 404)
  const canWork = a.canManage || a.isAssistant || (a.memberId !== null && row.assignedMemberId === a.memberId)
  return { row, a, canWork }
}

export async function getCase(actor: Actor, caseId: string): Promise<CaseDetailDto> {
  const { row, a, canWork } = await loadCase(actor, caseId)
  const [person, contacts] = await Promise.all([
    prisma.member.findUniqueOrThrow({
      where: { id: row.memberId },
      select: { gender: true, birthDate: true, street: true, neighborhood: true, city: true, latitude: true, longitude: true, invitedByName: true, contactSchedule: true },
    }),
    prisma.consolidationContact.findMany({
      where: { caseId, organizationId: actor.organizationId },
      orderBy: { contactedAt: "desc" },
      include: { madeBy: { select: { fullName: true } } },
    }),
  ])
  return {
    ...caseDto(row, a.memberId),
    notes: row.notes,
    person: {
      ...person,
      birthDate: person.birthDate ? ymd(person.birthDate) : null,
      latitude: person.latitude === null ? null : Number(person.latitude),
      longitude: person.longitude === null ? null : Number(person.longitude),
    },
    contacts: contacts.map((c) => ({
      id: c.id,
      contactedAt: c.contactedAt.toISOString(),
      channel: c.channel,
      summary: c.summary,
      interest: c.interest,
      nextContactAt: c.nextContactAt?.toISOString() ?? null,
      madeByName: c.madeBy?.fullName ?? null,
    })),
    canManage: a.canManage,
    canWork,
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────

export interface RegisterInput {
  fullName?: unknown
  phone?: unknown
  email?: unknown
  gender?: unknown
  birthDate?: unknown
  street?: unknown
  /** Dirección completa (con sugerencias y mapa); se guarda en `street`. */
  address?: unknown
  latitude?: unknown
  longitude?: unknown
  neighborhood?: unknown
  city?: unknown
  invitedByName?: unknown
  contactSchedule?: unknown
  acceptedChrist?: unknown
  serviceLabel?: unknown
  visitedAt?: unknown
  notes?: unknown
  assignedMemberId?: unknown
  assignToMe?: unknown
  useExisting?: unknown
}

export async function registerPerson(actor: Actor, ministryId: string, input: RegisterInput) {
  const a = await consolidationAccess(actor, ministryId)
  if (!a.canRegister) throw new CrudError("No tienes permiso para registrar personas en Consolidación", 403)

  const fullName = text(input.fullName, 150)
  if (!fullName) throw new CrudError("Escribe el nombre", 400, "fullName")
  const phone = text(input.phone, 30)
  const email = text(input.email, 150)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CrudError("Correo inválido", 400, "email")
  if (!phone && !email) throw new CrudError("Anota un teléfono o un correo para darle seguimiento", 400, "phone")

  const visitedAt = input.visitedAt ? new Date(`${String(input.visitedAt).slice(0, 10)}T00:00:00.000Z`) : new Date(`${ymd(new Date())}T00:00:00.000Z`)
  if (Number.isNaN(visitedAt.getTime())) throw new CrudError("Fecha de visita inválida", 400, "visitedAt")
  const birthRaw = input.birthDate ? new Date(`${String(input.birthDate).slice(0, 10)}T00:00:00.000Z`) : null
  if (birthRaw && (Number.isNaN(birthRaw.getTime()) || birthRaw > new Date())) throw new CrudError("Fecha de nacimiento inválida", 400, "birthDate")
  const gender = input.gender === "male" || input.gender === "female" ? input.gender : null

  let assignedMemberId: string | null = null
  if (a.canManage && typeof input.assignedMemberId === "string" && input.assignedMemberId) assignedMemberId = input.assignedMemberId
  else if (input.assignToMe === true && a.memberId) assignedMemberId = a.memberId
  if (assignedMemberId) {
    const ok = await prisma.ministryMember.findFirst({
      where: { organizationId: actor.organizationId, ministryId, memberId: assignedMemberId, isActive: true },
      select: { id: true },
    })
    if (!ok) throw new CrudError("Quien da seguimiento debe pertenecer al ministerio", 400, "assignedMemberId")
  }

  // ¿Ya está en el padrón? Se detecta por teléfono o correo.
  const digits = normalizePhone(phone)
  const dupes = await prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      OR: [...(digits ? [{ phone: { contains: digits } }] : []), ...(email ? [{ email }] : [])],
    },
    select: { id: true, fullName: true },
    take: 3,
  })
  if (dupes.length > 0 && input.useExisting !== true) {
    throw new CrudError(`Ya existe en el padrón: ${dupes.map((d) => d.fullName).join(", ")}. ¿Es la misma persona?`, 409, "duplicate")
  }

  const result = await prisma.$transaction(async (tx) => {
    let memberId = dupes[0]?.id ?? null
    if (!memberId) {
      const m = await tx.member.create({
        data: {
          organizationId: actor.organizationId,
          fullName,
          phone,
          email,
          gender,
          birthDate: birthRaw,
          street: text(input.address ?? input.street, 255),
          latitude: coord(input.latitude, -90, 90),
          longitude: coord(input.longitude, -180, 180),
          neighborhood: text(input.neighborhood, 100),
          city: text(input.city, 100),
          invitedByName: text(input.invitedByName, 150),
          contactSchedule: text(input.contactSchedule, 150),
          firstVisitAt: visitedAt,
          hierarchy: "believer",
          visionStage: "win",
        },
        select: { id: true },
      })
      await tx.memberStageLog.create({
        data: { organizationId: actor.organizationId, memberId: m.id, stage: "win", note: "Registro en Consolidación", changedById: actor.userId },
      })
      memberId = m.id
    }
    const existing = await tx.consolidationCase.findFirst({ where: { ministryId, memberId }, select: { id: true } })
    if (existing) throw new CrudError("Esa persona ya tiene seguimiento en Consolidación", 409, "duplicate")
    const created = await tx.consolidationCase.create({
      data: {
        organizationId: actor.organizationId,
        ministryId,
        memberId,
        visitedAt,
        serviceLabel: text(input.serviceLabel, 80),
        acceptedChrist: input.acceptedChrist === true,
        assignedMemberId,
        notes: text(input.notes, 2000),
        createdByUserId: actor.userId,
      },
      select: { id: true },
    })
    return { id: created.id, memberId }
  })
  if (assignedMemberId && assignedMemberId !== a.memberId) {
    fireAndForget(
      notifyMembers(actor.organizationId, [assignedMemberId], {
        kind: "consolidation_assigned",
        title: "Te asignaron a una persona nueva",
        body: `Da seguimiento a ${fullName}.`,
        link: `/mi/ministerios/${ministryId}/consolidacion`,
        excludeUserId: actor.userId,
      })
    )
  }
  return result
}

export interface UpdateCaseInput {
  status?: unknown
  assignedMemberId?: unknown
  outcome?: unknown
  outcomeNote?: unknown
  notes?: unknown
  address?: unknown
  latitude?: unknown
  longitude?: unknown
}

export async function updateCase(actor: Actor, caseId: string, input: UpdateCaseInput) {
  const { row, a, canWork } = await loadCase(actor, caseId)
  const data: Record<string, unknown> = {}

  if (input.assignedMemberId !== undefined) {
    if (!a.canManage) throw new CrudError("Solo el líder del ministerio puede asignar el seguimiento", 403)
    const id = typeof input.assignedMemberId === "string" && input.assignedMemberId ? input.assignedMemberId : null
    if (id) {
      const ok = await prisma.ministryMember.findFirst({
        where: { organizationId: actor.organizationId, ministryId: row.ministryId, memberId: id, isActive: true },
        select: { id: true },
      })
      if (!ok) throw new CrudError("Quien da seguimiento debe pertenecer al ministerio", 400, "assignedMemberId")
    }
    data.assignedMemberId = id
    if (id && id !== row.assignedMemberId) {
      fireAndForget(
        notifyMembers(actor.organizationId, [id], {
          kind: "consolidation_assigned",
          title: "Te asignaron a una persona nueva",
          body: "Revisa su ficha y registra tu primer contacto.",
          link: `/mi/ministerios/${row.ministryId}/consolidacion`,
          excludeUserId: actor.userId,
        })
      )
    }
  }

  const touchesProcess = input.status !== undefined || input.outcome !== undefined || input.outcomeNote !== undefined || input.notes !== undefined
  if (touchesProcess && !canWork) throw new CrudError("No tienes permiso para atender este caso", 403)

  if (input.notes !== undefined) data.notes = text(input.notes, 2000)

  let status: CaseStatusKey = row.status
  if (input.status !== undefined) {
    if (!isCaseStatus(input.status)) throw new CrudError("Estado inválido", 400, "status")
    if (!canTransition(row.status, input.status, a.canManage)) {
      throw new CrudError("Solo el líder puede reabrir un caso cerrado o canalizado", 403)
    }
    status = input.status
    data.status = status
    data.closedAt = status === "closed" || status === "channeled" ? new Date() : null
  }

  const outcome: OutcomeKey | null = input.outcome === undefined ? row.outcome : isOutcome(input.outcome) ? input.outcome : null
  if (input.outcome !== undefined) data.outcome = outcome
  if (input.outcomeNote !== undefined) data.outcomeNote = text(input.outcomeNote, 300)
  if (outcomeRequired(status) && !outcome) throw new CrudError("Indica a dónde se canalizó a la persona", 400, "outcome")
  if (status !== "channeled" && status !== "closed" && input.status !== undefined) {
    data.outcome = null
    data.outcomeNote = null
  }

  if (input.address !== undefined || input.latitude !== undefined || input.longitude !== undefined) {
    if (!canWork) throw new CrudError("No tienes permiso para atender este caso", 403)
    await prisma.member.update({
      where: { id: row.memberId },
      data: {
        ...(input.address !== undefined ? { street: text(input.address, 255) } : {}),
        ...(input.latitude !== undefined ? { latitude: coord(input.latitude, -90, 90) } : {}),
        ...(input.longitude !== undefined ? { longitude: coord(input.longitude, -180, 180) } : {}),
      },
    })
  }

  if (Object.keys(data).length === 0) return { ok: true }
  await prisma.consolidationCase.update({ where: { id: caseId }, data })
  return { ok: true }
}

// ── Canalizar a la célula más cercana ────────────────────────────────────────

export interface NearbyCellDto {
  id: string
  name: string
  typeId: string | null
  typeName: string | null
  dayOfWeek: number
  startTime: string
  address: string | null
  distanceKm: number
  members: number
  leaders: { name: string; phone: string | null }[]
}

export interface NearbyCellsDto {
  /** La persona tiene ubicación registrada. */
  hasLocation: boolean
  types: { id: string; name: string }[]
  cells: NearbyCellDto[]
}

/**
 * Células activas con ubicación, de la más cercana a la más lejana respecto al domicilio
 * de la persona; se puede filtrar por tipo (Mujeres, Matrimonios, Jóvenes…).
 */
export async function nearestCellsForCase(actor: Actor, caseId: string, typeId: string | null): Promise<NearbyCellsDto> {
  const { row, canWork } = await loadCase(actor, caseId)
  if (!canWork) throw new CrudError("No tienes permiso para atender este caso", 403)
  const [person, types] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: row.memberId }, select: { latitude: true, longitude: true } }),
    prisma.cellType.findMany({ where: { organizationId: actor.organizationId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  if (person.latitude === null || person.longitude === null) return { hasLocation: false, types, cells: [] }
  const cells = await prisma.cell.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      latitude: { not: null },
      longitude: { not: null },
      ...(typeId ? { typeId } : {}),
    },
    select: {
      id: true,
      name: true,
      typeId: true,
      type: { select: { name: true } },
      dayOfWeek: true,
      startTime: true,
      street: true,
      neighborhood: true,
      city: true,
      latitude: true,
      longitude: true,
      members: { where: { isActive: true }, select: { role: true, member: { select: { fullName: true, phone: true } } } },
    },
  })
  const ranked = rankByDistance(
    cells.map((cell) => ({ ...cell, lat: Number(cell.latitude), lng: Number(cell.longitude) })),
    { lat: Number(person.latitude), lng: Number(person.longitude) }
  )
  return {
    hasLocation: true,
    types,
    cells: ranked.slice(0, 8).map((cell) => ({
      id: cell.id,
      name: cell.name,
      typeId: cell.typeId,
      typeName: cell.type?.name ?? null,
      dayOfWeek: cell.dayOfWeek,
      startTime: cell.startTime,
      address: [cell.street, cell.neighborhood, cell.city].filter(Boolean).join(", ") || null,
      distanceKm: cell.distanceKm,
      members: cell.members.length,
      leaders: cell.members.filter((m) => m.role === "leader").map((m) => ({ name: m.member.fullName, phone: m.member.phone })),
    })),
  }
}

/** Integra a la persona a la célula elegida y deja el caso como canalizado. */
export async function channelCaseToCell(actor: Actor, caseId: string, cellId: unknown) {
  const { row, canWork } = await loadCase(actor, caseId)
  if (!canWork) throw new CrudError("No tienes permiso para atender este caso", 403)
  if (typeof cellId !== "string" || !cellId) throw new CrudError("Elige la célula", 400, "cellId")
  if (row.status === "closed") throw new CrudError("El caso está cerrado", 409)
  const cell = await prisma.cell.findFirst({
    where: { id: cellId, organizationId: actor.organizationId, isActive: true },
    select: { id: true, name: true, members: { where: { isActive: true, role: "leader" }, select: { member: { select: { fullName: true } } } } },
  })
  if (!cell) throw new CrudError("Célula no encontrada", 404)
  const other = await prisma.cellMember.findFirst({
    where: { memberId: row.memberId, isActive: true, cellId: { not: cellId }, cell: { isActive: true } },
    select: { cell: { select: { name: true } } },
  })
  if (other) throw new CrudError(`Ya pertenece a «${other.cell.name}». Un traspaso se solicita desde Células.`, 409, "cellId")
  const leaders = cell.members.map((m) => m.member.fullName).join(" y ")
  await prisma.$transaction(async (tx) => {
    await tx.cellMember.upsert({
      where: { cellId_memberId: { cellId, memberId: row.memberId } },
      update: { isActive: true },
      create: { organizationId: actor.organizationId, cellId, memberId: row.memberId, role: "member" },
    })
    await tx.consolidationCase.update({
      where: { id: caseId },
      data: {
        status: "channeled",
        outcome: "cell",
        outcomeNote: (`${cell.name}${leaders ? ` · líder: ${leaders}` : ""}`).slice(0, 300),
        closedAt: new Date(),
      },
    })
  })
  return { ok: true, cellName: cell.name }
}

export interface ContactInput {
  channel?: unknown
  summary?: unknown
  interest?: unknown
  nextContactAt?: unknown
  contactedAt?: unknown
}

export async function addContact(actor: Actor, caseId: string, input: ContactInput) {
  const { row, a, canWork } = await loadCase(actor, caseId)
  if (!canWork) throw new CrudError("No tienes permiso para atender este caso", 403)
  if (row.status === "closed") throw new CrudError("El caso está cerrado; reábrelo para registrar contactos", 409)
  if (!isChannel(input.channel)) throw new CrudError("Elige cómo lo contactaste", 400, "channel")
  const summary = text(input.summary, 2000)
  if (!summary) throw new CrudError("Anota qué hablaron", 400, "summary")
  const interest = isInterest(input.interest) ? input.interest : null
  const contactedAt = input.contactedAt ? new Date(String(input.contactedAt)) : new Date()
  if (Number.isNaN(contactedAt.getTime())) throw new CrudError("Fecha del contacto inválida", 400, "contactedAt")
  const next = input.nextContactAt ? new Date(String(input.nextContactAt)) : null
  if (next && Number.isNaN(next.getTime())) throw new CrudError("Fecha del próximo contacto inválida", 400, "nextContactAt")

  const memberId = a.memberId ?? (await memberIdOfUser(actor.organizationId, actor.userId))
  await prisma.$transaction(async (tx) => {
    await tx.consolidationContact.create({
      data: {
        organizationId: actor.organizationId,
        caseId,
        channel: input.channel as ChannelKey,
        summary,
        interest,
        contactedAt,
        nextContactAt: next,
        madeByMemberId: memberId,
        madeByUserId: actor.userId,
      },
    })
    // El primer contacto pone el caso en seguimiento.
    if (row.status === "received") await tx.consolidationCase.update({ where: { id: caseId }, data: { status: "following" } })
  })
  return { ok: true }
}
