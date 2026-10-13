import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import {
  canTransitionRequest,
  isAttendanceStatus,
  isMeetingKind,
  isMinistryRole,
  summarizeAttendance,
  type AttendanceStatusKey,
  type MeetingKindKey,
  type MinistryRoleKey,
  type RequestStatusKey,
} from "@/lib/ministries/rules"

// Ministerios: lógica de servidor. Todo se acota a la iglesia de la sesión.
//
// Acceso (rol + relación, nunca por reasignar el rol base):
//  - Permiso global `ministries.manage` → gestiona todos y decide requisiciones.
//  - Permiso global `ministries.view` → ve todos.
//  - Líder de un ministerio (o de su ministerio padre) → gestiona ese ministerio.
//  - Apoyo → además pasa lista. Servidor → ve su ministerio.
// Una persona puede estar en varios ministerios con un papel distinto en cada uno.

export interface Actor {
  userId: string
  organizationId: string
  canViewAll: boolean
  canManageAll: boolean
  /** Permiso global `kids.authorize_exit` (autorizar la salida de un niño). */
  canAuthorizeExit?: boolean
  /** Permisos globales de células y de creyentes (para el alcance por relación). */
  canViewCells?: boolean
  canManageCells?: boolean
  canManageMembers?: boolean
  canViewGatherings?: boolean
  canManageGatherings?: boolean
  canViewEvents?: boolean
  canManageEvents?: boolean
  canCheckinEvents?: boolean
  canViewSchool?: boolean
  canManageSchool?: boolean
  canViewFinance?: boolean
  canManageFinance?: boolean
  canManagePayroll?: boolean
  canViewVehicles?: boolean
  canManageVehicles?: boolean
  /** Permiso global `content.manage`: publicaciones y transmisiones del portal. */
  canManageContent?: boolean
  /** Permiso global `panel.stats`: estadísticos de la iglesia. */
  canViewStats?: boolean
  /** Permiso global `reports.view`. */
  canViewReports?: boolean
}

export interface MinistryAccess {
  ministry: { id: string; organizationId: string; parentId: string | null; name: string; isActive: boolean }
  memberId: string | null
  /** Papel efectivo (propio o heredado del ministerio padre); null si no pertenece. */
  myRole: MinistryRoleKey | null
  canView: boolean
  canManage: boolean
  canTakeAttendance: boolean
  /** Decidir requisiciones: solo con permiso global. */
  canDecide: boolean
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

export async function memberIdOfUser(organizationId: string, userId: string): Promise<string | null> {
  const m = await prisma.member.findFirst({ where: { organizationId, userId, isActive: true }, select: { id: true } })
  return m?.id ?? null
}

export async function ministryAccess(actor: Actor, ministryId: string): Promise<MinistryAccess> {
  const ministry = await prisma.ministry.findFirst({
    where: { id: ministryId, organizationId: actor.organizationId },
    select: { id: true, organizationId: true, parentId: true, name: true, isActive: true },
  })
  if (!ministry) throw new CrudError("Ministerio no encontrado", 404)

  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  let myRole: MinistryRoleKey | null = null
  if (memberId) {
    // Cadena del ministerio y sus ancestros: un líder del padre gestiona sus áreas.
    const chain: string[] = [ministry.id]
    let cursor = ministry.parentId
    for (let i = 0; cursor && i < 5; i++) {
      chain.push(cursor)
      const parent: { parentId: string | null } | null = await prisma.ministry.findFirst({
        where: { id: cursor, organizationId: actor.organizationId },
        select: { parentId: true },
      })
      cursor = parent?.parentId ?? null
    }
    const rows = await prisma.ministryMember.findMany({
      where: { organizationId: actor.organizationId, memberId, isActive: true, ministryId: { in: chain } },
      select: { ministryId: true, role: true },
    })
    const own = rows.find((r) => r.ministryId === ministry.id)?.role
    const inherited = rows.some((r) => r.ministryId !== ministry.id && r.role === "leader")
    myRole = own ?? (inherited ? "leader" : null)
    if (own && own !== "leader" && inherited) myRole = "leader"
  }

  const canManage = actor.canManageAll || myRole === "leader"
  return {
    ministry,
    memberId,
    myRole,
    canManage,
    canTakeAttendance: canManage || myRole === "assistant",
    canView: actor.canViewAll || actor.canManageAll || myRole !== null,
    canDecide: actor.canManageAll,
  }
}

function assertView(a: MinistryAccess) {
  // 404 y no 403: no revela la existencia de ministerios ajenos.
  if (!a.canView) throw new CrudError("Ministerio no encontrado", 404)
}
function assertManage(a: MinistryAccess) {
  assertView(a)
  if (!a.canManage) throw new CrudError("No tienes permiso para gestionar este ministerio", 403)
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export interface MinistryMemberDto {
  id: string
  memberId: string
  fullName: string
  phone: string | null
  imageUrl: string | null
  role: MinistryRoleKey
  positionTitle: string | null
  joinedAt: string
}

export interface MeetingDto {
  id: string
  title: string
  kind: MeetingKindKey
  startsAt: string
  location: string | null
  notes: string | null
  attendance: { total: number; present: number; absent: number; excused: number; rate: number | null }
  myStatus: AttendanceStatusKey | null
}

export interface RequestDto {
  id: string
  title: string
  description: string | null
  quantity: number | null
  neededBy: string | null
  status: RequestStatusKey
  requestedByUserId: string
  requestedByName: string | null
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
  mine: boolean
}

export interface WorkspaceDto {
  ministry: {
    id: string
    name: string
    kind: string
    description: string | null
    requirements: string | null
    imageUrl: string | null
    parent: { id: string; name: string } | null
    children: { id: string; name: string; memberCount: number }[]
    isActive: boolean
  }
  access: { myRole: MinistryRoleKey | null; canManage: boolean; canTakeAttendance: boolean; canDecide: boolean }
  members: MinistryMemberDto[]
  meetings: MeetingDto[]
  /** Solo quien gestiona (líder o permiso global) ve las requisiciones. */
  requests: RequestDto[] | null
}

export async function getWorkspace(actor: Actor, ministryId: string): Promise<WorkspaceDto> {
  const access = await ministryAccess(actor, ministryId)
  assertView(access)
  const orgId = actor.organizationId

  const [ministry, members, meetings, children] = await Promise.all([
    prisma.ministry.findFirstOrThrow({
      where: { id: ministryId, organizationId: orgId },
      include: { parent: { select: { id: true, name: true } } },
    }),
    prisma.ministryMember.findMany({
      where: { ministryId, organizationId: orgId, isActive: true, member: { isActive: true } },
      include: { member: { select: { fullName: true, phone: true, imageUrl: true } } },
    }),
    prisma.ministryMeeting.findMany({
      where: { ministryId, organizationId: orgId },
      orderBy: { startsAt: "desc" },
      take: 30,
      include: { attendance: { select: { memberId: true, status: true } } },
    }),
    prisma.ministry.findMany({
      where: { parentId: ministryId, organizationId: orgId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { members: { where: { isActive: true } } } } },
    }),
  ])

  const rank: Record<MinistryRoleKey, number> = { leader: 0, assistant: 1, servant: 2 }
  const membersDto: MinistryMemberDto[] = members
    .map((m) => ({
      id: m.id,
      memberId: m.memberId,
      fullName: m.member.fullName,
      // El teléfono solo lo ve quien gestiona.
      phone: access.canManage ? m.member.phone : null,
      imageUrl: m.member.imageUrl,
      role: m.role as MinistryRoleKey,
      positionTitle: m.positionTitle,
      joinedAt: m.joinedAt.toISOString(),
    }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.fullName.localeCompare(b.fullName, "es"))

  const meetingsDto: MeetingDto[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    kind: m.kind as MeetingKindKey,
    startsAt: m.startsAt.toISOString(),
    location: m.location,
    notes: m.notes,
    attendance: summarizeAttendance(m.attendance.map((a) => a.status as AttendanceStatusKey)),
    myStatus: (m.attendance.find((a) => a.memberId === access.memberId)?.status as AttendanceStatusKey | undefined) ?? null,
  }))

  let requests: RequestDto[] | null = null
  if (access.canManage) {
    const rows = await prisma.ministryRequest.findMany({
      where: { ministryId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.requestedByUserId))] } },
      select: { id: true, fullName: true },
    })
    const names = new Map(users.map((u) => [u.id, u.fullName]))
    requests = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      quantity: r.quantity,
      neededBy: r.neededBy ? r.neededBy.toISOString().slice(0, 10) : null,
      status: r.status as RequestStatusKey,
      requestedByUserId: r.requestedByUserId,
      requestedByName: names.get(r.requestedByUserId) ?? null,
      decisionNote: r.decisionNote,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      mine: r.requestedByUserId === actor.userId,
    }))
  }

  return {
    ministry: {
      id: ministry.id,
      name: ministry.name,
      kind: ministry.kind,
      description: ministry.description,
      requirements: ministry.requirements,
      imageUrl: ministry.imageUrl,
      parent: ministry.parent,
      children: children.map((c) => ({ id: c.id, name: c.name, memberCount: c._count.members })),
      isActive: ministry.isActive,
    },
    access: {
      myRole: access.myRole,
      canManage: access.canManage,
      canTakeAttendance: access.canTakeAttendance,
      canDecide: access.canDecide,
    },
    members: membersDto,
    meetings: meetingsDto,
    requests,
  }
}

export interface MyMinistryDto {
  id: string
  name: string
  role: MinistryRoleKey
  positionTitle: string | null
  parentName: string | null
  memberCount: number
  nextMeeting: { id: string; title: string; startsAt: string } | null
}

/** Ministerios a los que pertenece la persona de la sesión (puede ser varios, con papeles distintos). */
export async function listMyMinistries(organizationId: string, userId: string): Promise<MyMinistryDto[]> {
  const memberId = await memberIdOfUser(organizationId, userId)
  if (!memberId) return []
  const rows = await prisma.ministryMember.findMany({
    where: { organizationId, memberId, isActive: true, ministry: { isActive: true } },
    include: {
      ministry: {
        select: {
          id: true,
          name: true,
          parent: { select: { name: true } },
          _count: { select: { members: { where: { isActive: true } } } },
          meetings: {
            where: { startsAt: { gte: new Date() } },
            orderBy: { startsAt: "asc" },
            take: 1,
            select: { id: true, title: true, startsAt: true },
          },
        },
      },
    },
  })
  return rows
    .map((r) => ({
      id: r.ministry.id,
      name: r.ministry.name,
      role: r.role as MinistryRoleKey,
      positionTitle: r.positionTitle,
      parentName: r.ministry.parent?.name ?? null,
      memberCount: r.ministry._count.members,
      nextMeeting: r.ministry.meetings[0]
        ? { id: r.ministry.meetings[0].id, title: r.ministry.meetings[0].title, startsAt: r.ministry.meetings[0].startsAt.toISOString() }
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
}

// ── Miembros ─────────────────────────────────────────────────────────────────

/** Creyentes que aún no están en el ministerio (para agregarlos). Mínimo de datos. */
export async function searchCandidates(actor: Actor, ministryId: string, q: string) {
  assertManage(await ministryAccess(actor, ministryId))
  const term = q.trim()
  const rows = await prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      ministryMemberships: { none: { ministryId, isActive: true } },
      ...(term ? { OR: [{ fullName: { contains: term } }, { phone: { contains: term } }] } : {}),
    },
    orderBy: { fullName: "asc" },
    take: 20,
    select: { id: true, fullName: true, imageUrl: true },
  })
  return rows
}

export async function addMinistryMember(
  actor: Actor,
  ministryId: string,
  input: { memberId?: unknown; role?: unknown; positionTitle?: unknown }
) {
  assertManage(await ministryAccess(actor, ministryId))
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige al creyente", 400, "memberId")
  const role: MinistryRoleKey = isMinistryRole(input.role) ? input.role : "servant"
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: actor.organizationId, isActive: true },
    select: { id: true },
  })
  if (!member) throw new CrudError("El creyente no existe en esta iglesia", 400, "memberId")
  const positionTitle = text(input.positionTitle, 100)
  const row = await prisma.ministryMember.upsert({
    where: { ministryId_memberId: { ministryId, memberId } },
    update: { isActive: true, role, positionTitle },
    create: { organizationId: actor.organizationId, ministryId, memberId, role, positionTitle },
  })
  return { id: row.id }
}

async function findMembership(actor: Actor, ministryId: string, membershipId: string) {
  const row = await prisma.ministryMember.findFirst({
    where: { id: membershipId, ministryId, organizationId: actor.organizationId },
  })
  if (!row) throw new CrudError("Miembro no encontrado", 404)
  return row
}

/** Evita dejar un ministerio sin líder cuando el cambio lo quita y no hay otro. */
async function assertKeepsLeader(ministryId: string, organizationId: string, exceptId: string, actor: Actor, access: MinistryAccess) {
  if (access.canDecide) return // quien administra puede dejar el ministerio sin líder
  const others = await prisma.ministryMember.count({
    where: { ministryId, organizationId, role: "leader", isActive: true, id: { not: exceptId } },
  })
  if (others === 0) throw new CrudError("El ministerio debe conservar al menos un líder", 409)
}

export async function updateMinistryMember(
  actor: Actor,
  ministryId: string,
  membershipId: string,
  input: { role?: unknown; positionTitle?: unknown }
) {
  const access = await ministryAccess(actor, ministryId)
  assertManage(access)
  const row = await findMembership(actor, ministryId, membershipId)
  const data: { role?: MinistryRoleKey; positionTitle?: string | null } = {}
  if (input.role !== undefined) {
    if (!isMinistryRole(input.role)) throw new CrudError("Papel inválido", 400, "role")
    if (row.role === "leader" && input.role !== "leader") await assertKeepsLeader(ministryId, actor.organizationId, row.id, actor, access)
    data.role = input.role
  }
  if (input.positionTitle !== undefined) data.positionTitle = text(input.positionTitle, 100)
  await prisma.ministryMember.update({ where: { id: row.id }, data })
}

export async function removeMinistryMember(actor: Actor, ministryId: string, membershipId: string) {
  const access = await ministryAccess(actor, ministryId)
  assertManage(access)
  const row = await findMembership(actor, ministryId, membershipId)
  if (row.role === "leader") await assertKeepsLeader(ministryId, actor.organizationId, row.id, actor, access)
  // Se inactiva: el historial de asistencia se conserva.
  await prisma.ministryMember.update({ where: { id: row.id }, data: { isActive: false } })
}

// ── Reuniones y lista ────────────────────────────────────────────────────────

export async function createMeeting(
  actor: Actor,
  ministryId: string,
  input: { title?: unknown; kind?: unknown; startsAt?: unknown; location?: unknown; notes?: unknown }
) {
  assertManage(await ministryAccess(actor, ministryId))
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el título", 400, "title")
  const startsAt = new Date(String(input.startsAt ?? ""))
  if (Number.isNaN(startsAt.getTime())) throw new CrudError("Fecha y hora inválidas", 400, "startsAt")
  const kind: MeetingKindKey = isMeetingKind(input.kind) ? input.kind : "internal"
  const row = await prisma.ministryMeeting.create({
    data: {
      organizationId: actor.organizationId,
      ministryId,
      title,
      kind,
      startsAt,
      location: text(input.location, 150),
      notes: text(input.notes, 1000),
      createdByUserId: actor.userId,
    },
  })
  return { id: row.id }
}

async function meetingWithAccess(actor: Actor, meetingId: string) {
  const meeting = await prisma.ministryMeeting.findFirst({
    where: { id: meetingId, organizationId: actor.organizationId },
  })
  if (!meeting) throw new CrudError("Reunión no encontrada", 404)
  const access = await ministryAccess(actor, meeting.ministryId)
  return { meeting, access }
}

export interface AttendanceSheet {
  meeting: { id: string; title: string; kind: MeetingKindKey; startsAt: string }
  rows: { memberId: string; fullName: string; role: MinistryRoleKey; status: AttendanceStatusKey | null; note: string | null }[]
  canEdit: boolean
}

export async function getAttendanceSheet(actor: Actor, meetingId: string): Promise<AttendanceSheet> {
  const { meeting, access } = await meetingWithAccess(actor, meetingId)
  assertView(access)
  const [members, marks] = await Promise.all([
    prisma.ministryMember.findMany({
      where: { ministryId: meeting.ministryId, organizationId: actor.organizationId, isActive: true, member: { isActive: true } },
      include: { member: { select: { fullName: true } } },
    }),
    prisma.ministryAttendance.findMany({ where: { meetingId, organizationId: actor.organizationId } }),
  ])
  const byMember = new Map(marks.map((m) => [m.memberId, m]))
  // También aparecen quienes ya tenían registro aunque hoy estén inactivos.
  const inactiveIds = marks.filter((m) => !members.some((x) => x.memberId === m.memberId)).map((m) => m.memberId)
  const extra = inactiveIds.length
    ? await prisma.member.findMany({ where: { id: { in: inactiveIds }, organizationId: actor.organizationId }, select: { id: true, fullName: true } })
    : []
  const rows = [
    ...members.map((m) => ({
      memberId: m.memberId,
      fullName: m.member.fullName,
      role: m.role as MinistryRoleKey,
      status: (byMember.get(m.memberId)?.status as AttendanceStatusKey | undefined) ?? null,
      note: byMember.get(m.memberId)?.note ?? null,
    })),
    ...extra.map((m) => ({
      memberId: m.id,
      fullName: m.fullName,
      role: "servant" as MinistryRoleKey,
      status: (byMember.get(m.id)?.status as AttendanceStatusKey | undefined) ?? null,
      note: byMember.get(m.id)?.note ?? null,
    })),
  ].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"))
  return {
    meeting: { id: meeting.id, title: meeting.title, kind: meeting.kind as MeetingKindKey, startsAt: meeting.startsAt.toISOString() },
    rows,
    canEdit: access.canTakeAttendance,
  }
}

export async function saveAttendance(
  actor: Actor,
  meetingId: string,
  records: { memberId?: unknown; status?: unknown; note?: unknown }[]
) {
  const { meeting, access } = await meetingWithAccess(actor, meetingId)
  assertView(access)
  if (!access.canTakeAttendance) throw new CrudError("No tienes permiso para pasar lista", 403)
  if (!Array.isArray(records) || records.length > 500) throw new CrudError("Lista inválida", 400)

  const valid = await prisma.ministryMember.findMany({
    where: { ministryId: meeting.ministryId, organizationId: actor.organizationId, isActive: true },
    select: { memberId: true },
  })
  const allowed = new Set(valid.map((v) => v.memberId))
  const clean: { memberId: string; status: AttendanceStatusKey; note: string | null }[] = []
  for (const r of records) {
    const memberId = text(r.memberId, 40)
    if (!memberId || !allowed.has(memberId)) throw new CrudError("La lista incluye a alguien que no pertenece al ministerio", 400)
    if (!isAttendanceStatus(r.status)) throw new CrudError("Estado de asistencia inválido", 400)
    clean.push({ memberId, status: r.status, note: text(r.note, 200) })
  }

  await prisma.$transaction(
    clean.map((r) =>
      prisma.ministryAttendance.upsert({
        where: { meetingId_memberId: { meetingId, memberId: r.memberId } },
        update: { status: r.status, note: r.note, markedByUserId: actor.userId, markedAt: new Date() },
        create: {
          organizationId: actor.organizationId,
          meetingId,
          memberId: r.memberId,
          status: r.status,
          note: r.note,
          markedByUserId: actor.userId,
        },
      })
    )
  )
  return { saved: clean.length }
}

export async function deleteMeeting(actor: Actor, meetingId: string) {
  const { meeting, access } = await meetingWithAccess(actor, meetingId)
  assertManage(access)
  const marked = await prisma.ministryAttendance.count({ where: { meetingId } })
  if (marked > 0) throw new CrudError("La reunión ya tiene asistencia registrada y no se puede eliminar", 409)
  await prisma.ministryMeeting.delete({ where: { id: meeting.id } })
}

// ── Requisiciones ────────────────────────────────────────────────────────────

export async function createRequest(
  actor: Actor,
  ministryId: string,
  input: { title?: unknown; description?: unknown; quantity?: unknown; neededBy?: unknown }
) {
  assertManage(await ministryAccess(actor, ministryId))
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe qué necesita el ministerio", 400, "title")
  let quantity: number | null = null
  if (input.quantity !== undefined && input.quantity !== null && input.quantity !== "") {
    const n = Number(input.quantity)
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw new CrudError("Cantidad inválida", 400, "quantity")
    quantity = n
  }
  let neededBy: Date | null = null
  const rawDate = text(input.neededBy, 30)
  if (rawDate) {
    const d = new Date(rawDate.length === 10 ? `${rawDate}T00:00:00.000Z` : rawDate)
    if (Number.isNaN(d.getTime())) throw new CrudError("Fecha inválida", 400, "neededBy")
    neededBy = d
  }
  const row = await prisma.ministryRequest.create({
    data: {
      organizationId: actor.organizationId,
      ministryId,
      title,
      description: text(input.description, 1000),
      quantity,
      neededBy,
      requestedByUserId: actor.userId,
    },
  })
  return { id: row.id }
}

export async function changeRequestStatus(
  actor: Actor,
  requestId: string,
  to: unknown,
  note?: unknown
) {
  const request = await prisma.ministryRequest.findFirst({
    where: { id: requestId, organizationId: actor.organizationId },
  })
  if (!request) throw new CrudError("Requisición no encontrada", 404)
  const access = await ministryAccess(actor, request.ministryId)
  assertManage(access)
  const target = typeof to === "string" ? (to as RequestStatusKey) : null
  if (!target) throw new CrudError("Estado inválido", 400)
  const isRequester = request.requestedByUserId === actor.userId
  const asAdmin = access.canDecide && canTransitionRequest(request.status as RequestStatusKey, target, "admin")
  const asRequester = isRequester && canTransitionRequest(request.status as RequestStatusKey, target, "requester")
  if (!asAdmin && !asRequester) throw new CrudError("No puedes hacer ese cambio en esta requisición", 403)
  await prisma.ministryRequest.update({
    where: { id: request.id },
    data: {
      status: target,
      decisionNote: text(note, 300),
      decidedByUserId: asAdmin ? actor.userId : request.decidedByUserId,
      decidedAt: asAdmin ? new Date() : request.decidedAt,
    },
  })
}
