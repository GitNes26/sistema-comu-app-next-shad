import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { persistNotification } from "@/lib/notifications/helpers"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import {
  BABY_CHECKLIST,
  DEFAULT_ROOMS,
  ageInMonths,
  ageLabel,
  isValidBirthDate,
  parseQrPayload,
  roomForAge,
  sanitizeChecklist,
  type RoomRange,
} from "@/lib/kids/rules"

// Comunidad Kids: niños, salones, servicios, entrada/salida por QR y mensajes con
// los padres. El ministerio es un `Ministry` con kind = "kids".
//
//  - Personal = integrante de un ministerio Kids (o permiso global de ministerios).
//  - Registrar niños, dar entrada y escribir a los padres: todo el personal.
//  - Abrir/cerrar servicios y asignar maestros: líder, apoyo o permiso global.
//  - AUTORIZAR LA SALIDA: solo con el permiso `kids.authorize_exit` (rol ∩ plan),
//    no por mostrar el QR ni por ser integrante del ministerio.
//  - Los padres ven a sus hijos por la relación de tutela, nunca por rol.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const todayUtc = () => new Date(`${ymd(new Date())}T00:00:00.000Z`)
const newToken = () => randomBytes(18).toString("base64url")

// ── Acceso ───────────────────────────────────────────────────────────────────

export interface KidsStaff {
  isStaff: boolean
  canManage: boolean
  canAuthorizeExit: boolean
  memberId: string | null
}

/** Personal de Kids de la iglesia: rol en cualquier ministerio Kids activo o permiso global. */
async function staffOf(actor: Actor): Promise<KidsStaff> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  let role: "leader" | "assistant" | "servant" | null = null
  if (memberId) {
    const rows = await prisma.ministryMember.findMany({
      where: { organizationId: actor.organizationId, memberId, isActive: true, ministry: { kind: "kids", isActive: true } },
      select: { role: true },
    })
    if (rows.some((r) => r.role === "leader")) role = "leader"
    else if (rows.some((r) => r.role === "assistant")) role = "assistant"
    else if (rows.length > 0) role = "servant"
  }
  const isStaff = actor.canManageAll || actor.canViewAll || role !== null
  const canManage = actor.canManageAll || role === "leader" || role === "assistant"
  return { isStaff, canManage, canAuthorizeExit: Boolean(actor.canAuthorizeExit) && isStaff, memberId }
}

async function kidsMinistryAccess(actor: Actor, ministryId: string) {
  const access = await ministryAccess(actor, ministryId)
  const ministry = await prisma.ministry.findFirst({
    where: { id: ministryId, organizationId: actor.organizationId },
    select: { kind: true },
  })
  if (!ministry || ministry.kind !== "kids" || !access.canView) throw new CrudError("Ministerio no encontrado", 404)
  const staff = await staffOf(actor)
  return {
    ...staff,
    isStaff: true,
    canManage: access.canManage || access.myRole === "assistant",
    canAuthorizeExit: Boolean(actor.canAuthorizeExit),
    memberId: access.memberId,
  }
}

// ── Salones ──────────────────────────────────────────────────────────────────

export interface RoomDto extends RoomRange {
  present: number
}

async function ensureRooms(organizationId: string) {
  const count = await prisma.kidsRoom.count({ where: { organizationId } })
  if (count === 0) {
    await prisma.kidsRoom.createMany({ data: DEFAULT_ROOMS.map((r) => ({ ...r, organizationId })) })
  }
  return prisma.kidsRoom.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } })
}

export async function saveRoom(actor: Actor, ministryId: string, input: Record<string, unknown>) {
  const a = await kidsMinistryAccess(actor, ministryId)
  if (!a.canManage) throw new CrudError("Solo la dirección de Kids puede configurar los salones", 403)
  const name = text(input.name, 60)
  if (!name) throw new CrudError("Escribe el nombre del salón", 400, "name")
  const min = Number(input.minAgeMonths)
  const max = Number(input.maxAgeMonths)
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > 216) {
    throw new CrudError("Rango de edad inválido (en meses)", 400, "maxAgeMonths")
  }
  const section = input.section === "baby" ? "baby" : "child"
  const data = {
    name,
    section,
    minAgeMonths: min,
    maxAgeMonths: max,
    sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    isActive: input.isActive === false ? false : true,
  } as const
  const id = typeof input.id === "string" && input.id ? input.id : null
  try {
    if (id) {
      const r = await prisma.kidsRoom.updateMany({ where: { id, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Salón no encontrado", 404)
      return { id }
    }
    const row = await prisma.kidsRoom.create({ data: { ...data, organizationId: actor.organizationId } })
    return { id: row.id }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
      throw new CrudError("Ya existe un salón con ese nombre", 409, "name")
    }
    throw err
  }
}

// ── Niños ────────────────────────────────────────────────────────────────────

export interface GuardianDto {
  memberId: string
  fullName: string
  phone: string | null
  relation: string
  hasAccess: boolean
}

export interface ChildDto {
  id: string
  fullName: string
  birthDate: string
  ageLabel: string
  ageMonths: number
  gender: string | null
  imageUrl: string | null
  indications: string | null
  roomId: string | null
  /** Salón efectivo (fijado o deducido por la edad). */
  roomName: string | null
  section: "baby" | "child" | null
  isActive: boolean
  /** Valor del QR: solo lo reciben el personal y los tutores. */
  qrToken: string
  guardians: GuardianDto[]
}

const childInclude = {
  room: true,
  guardians: { include: { member: { select: { fullName: true, phone: true, userId: true } } } },
}
type ChildRow = Awaited<ReturnType<typeof prisma.kidsChild.findFirstOrThrow<{ include: typeof childInclude }>>>

function childDto(c: ChildRow, rooms: RoomRange[]): ChildDto {
  const months = ageInMonths(c.birthDate)
  const room = c.room ?? roomForAge(rooms, months)
  return {
    id: c.id,
    fullName: c.fullName,
    birthDate: ymd(c.birthDate),
    ageLabel: ageLabel(c.birthDate),
    ageMonths: months,
    gender: c.gender,
    imageUrl: c.imageUrl,
    indications: c.indications,
    roomId: c.roomId,
    roomName: room?.name ?? null,
    section: room?.section ?? null,
    isActive: c.isActive,
    qrToken: c.qrToken,
    guardians: c.guardians.map((g) => ({
      memberId: g.memberId,
      fullName: g.member.fullName,
      phone: g.member.phone,
      relation: g.relation,
      hasAccess: g.member.userId !== null,
    })),
  }
}

/** Cargar un niño y comprobar quién consulta: personal o tutor. 404 para todo lo demás. */
async function childFor(actor: Actor, childId: string) {
  const [staff, rooms, child] = await Promise.all([
    staffOf(actor),
    ensureRooms(actor.organizationId),
    prisma.kidsChild.findFirst({ where: { id: childId, organizationId: actor.organizationId }, include: childInclude }),
  ])
  if (!child) throw new CrudError("Niño no encontrado", 404)
  const isGuardian = staff.memberId !== null && child.guardians.some((g) => g.memberId === staff.memberId)
  if (!staff.isStaff && !isGuardian) throw new CrudError("Niño no encontrado", 404)
  return { child, staff, isGuardian, rooms }
}

export async function listChildren(actor: Actor, ministryId: string, q: string) {
  await kidsMinistryAccess(actor, ministryId)
  const term = q.trim()
  const [rooms, rows] = await Promise.all([
    ensureRooms(actor.organizationId),
    prisma.kidsChild.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(term ? { fullName: { contains: term } } : {}),
      },
      include: childInclude,
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      take: 200,
    }),
  ])
  return rows.map((c) => childDto(c, rooms))
}

export interface ChildInput {
  fullName?: unknown
  birthDate?: unknown
  gender?: unknown
  imageUrl?: unknown
  indications?: unknown
  roomId?: unknown
  isActive?: unknown
  /** Al registrar: tutores (creyentes) con su parentesco. */
  guardians?: unknown
}

async function parseChild(actor: Actor, input: ChildInput, partial: boolean) {
  const out: Record<string, unknown> = {}
  if (!partial || input.fullName !== undefined) {
    const name = text(input.fullName, 150)
    if (!name) throw new CrudError("Escribe el nombre del niño", 400, "fullName")
    out.fullName = name
  }
  if (!partial || input.birthDate !== undefined) {
    const d = new Date(`${String(input.birthDate ?? "").slice(0, 10)}T00:00:00.000Z`)
    if (!isValidBirthDate(d)) throw new CrudError("Fecha de nacimiento inválida (de 0 a 18 años)", 400, "birthDate")
    out.birthDate = d
  }
  if (input.gender !== undefined) out.gender = input.gender === "male" || input.gender === "female" ? input.gender : null
  if (input.imageUrl !== undefined) out.imageUrl = text(input.imageUrl, 500)
  if (input.indications !== undefined) out.indications = text(input.indications, 2000)
  if (input.isActive !== undefined) out.isActive = input.isActive !== false
  if (input.roomId !== undefined) {
    const id = text(input.roomId, 40)
    if (id) {
      const ok = await prisma.kidsRoom.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } })
      if (!ok) throw new CrudError("Salón no válido", 400, "roomId")
    }
    out.roomId = id
  }
  return out
}

/** El personal registra al niño en la entrada; un tutor puede registrar a sus hijos desde su espacio. */
export async function createChild(actor: Actor, input: ChildInput, mode: "staff" | "guardian") {
  const staff = await staffOf(actor)
  if (mode === "staff" && !staff.isStaff) throw new CrudError("No tienes permiso para registrar niños", 403)
  const data = await parseChild(actor, input, false)

  const guardianInputs: { memberId: string; relation: string }[] = []
  if (mode === "guardian") {
    if (!staff.memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente; pide a la secretaría que la vincule", 409)
    guardianInputs.push({ memberId: staff.memberId, relation: text(input.guardians, 40) ?? "Padre/Madre" })
  } else if (Array.isArray(input.guardians)) {
    for (const g of input.guardians.slice(0, 6)) {
      const rec = (g ?? {}) as Record<string, unknown>
      const memberId = text(rec.memberId, 40)
      if (memberId) guardianInputs.push({ memberId, relation: text(rec.relation, 40) ?? "Padre/Madre" })
    }
  }
  if (guardianInputs.length > 0) {
    const found = await prisma.member.count({
      where: { organizationId: actor.organizationId, id: { in: guardianInputs.map((g) => g.memberId) } },
    })
    if (found !== new Set(guardianInputs.map((g) => g.memberId)).size) throw new CrudError("Tutor no válido", 400, "guardians")
  }

  const row = await prisma.kidsChild.create({
    data: {
      organizationId: actor.organizationId,
      fullName: data.fullName as string,
      birthDate: data.birthDate as Date,
      gender: (data.gender as "male" | "female" | null | undefined) ?? null,
      imageUrl: (data.imageUrl as string | null | undefined) ?? null,
      indications: (data.indications as string | null | undefined) ?? null,
      roomId: mode === "staff" ? ((data.roomId as string | null | undefined) ?? null) : null,
      qrToken: newToken(),
      guardians: {
        create: [...new Map(guardianInputs.map((g) => [g.memberId, g])).values()].map((g) => ({
          organizationId: actor.organizationId,
          memberId: g.memberId,
          relation: g.relation,
        })),
      },
    },
    select: { id: true },
  })
  return { id: row.id }
}

export async function updateChild(actor: Actor, childId: string, input: ChildInput) {
  const { child, staff, isGuardian } = await childFor(actor, childId)
  if (!staff.isStaff && !isGuardian) throw new CrudError("Niño no encontrado", 404)
  const data = await parseChild(actor, input, true)
  // Un tutor solo corrige datos del niño; el salón y la baja los decide el personal.
  if (!staff.isStaff) {
    delete data.roomId
    delete data.isActive
  }
  if (Object.keys(data).length === 0) return { id: child.id }
  await prisma.kidsChild.update({ where: { id: child.id }, data })
  return { id: child.id }
}

export async function addGuardian(actor: Actor, childId: string, input: { memberId?: unknown; relation?: unknown }) {
  const { child, staff, isGuardian } = await childFor(actor, childId)
  if (!staff.isStaff && !isGuardian) throw new CrudError("Niño no encontrado", 404)
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige a la persona", 400, "memberId")
  const member = await prisma.member.findFirst({ where: { id: memberId, organizationId: actor.organizationId }, select: { id: true } })
  if (!member) throw new CrudError("Persona no encontrada", 404)
  await prisma.kidsGuardian.upsert({
    where: { childId_memberId: { childId: child.id, memberId } },
    update: { relation: text(input.relation, 40) ?? "Padre/Madre" },
    create: { organizationId: actor.organizationId, childId: child.id, memberId, relation: text(input.relation, 40) ?? "Padre/Madre" },
  })
  return { ok: true }
}

export async function removeGuardian(actor: Actor, childId: string, memberId: string) {
  const { child, staff } = await childFor(actor, childId)
  if (!staff.isStaff) throw new CrudError("Solo el personal puede quitar a un tutor", 403)
  const count = await prisma.kidsGuardian.count({ where: { childId: child.id } })
  if (count <= 1) throw new CrudError("El niño debe conservar al menos un tutor", 409)
  await prisma.kidsGuardian.deleteMany({ where: { childId: child.id, memberId } })
  return { ok: true }
}

/** Busca creyentes para vincularlos como tutores (solo personal). */
export async function searchGuardians(actor: Actor, ministryId: string, q: string) {
  await kidsMinistryAccess(actor, ministryId)
  const term = q.trim()
  if (term.length < 2) return []
  return prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      OR: [{ fullName: { contains: term } }, { phone: { contains: term } }],
    },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: "asc" },
    take: 15,
  })
}

// ── Mis hijos (tutores) ──────────────────────────────────────────────────────

export interface MyChildDto extends ChildDto {
  myRelation: string
  /** Dónde está ahora (si está en un servicio abierto). */
  current: { sessionLabel: string; roomName: string; checkInAt: string; checkOutAt: string | null } | null
  unread: number
}

export async function listMyChildren(actor: Actor): Promise<MyChildDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const [rooms, links] = await Promise.all([
    ensureRooms(actor.organizationId),
    prisma.kidsGuardian.findMany({
      where: { organizationId: actor.organizationId, memberId, child: { isActive: true } },
      include: { child: { include: childInclude } },
      orderBy: { child: { fullName: "asc" } },
    }),
  ])
  const ids = links.map((l) => l.childId)
  const [today, unreadRows] = await Promise.all([
    prisma.kidsAttendance.findMany({
      where: { organizationId: actor.organizationId, childId: { in: ids }, session: { date: todayUtc() } },
      include: { session: { select: { label: true } }, room: { select: { name: true } } },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.kidsMessage.groupBy({
      by: ["childId"],
      where: { organizationId: actor.organizationId, childId: { in: ids }, direction: "to_parent", readAt: null },
      _count: { _all: true },
    }),
  ])
  return links.map((l) => {
    const att = today.find((t) => t.childId === l.childId)
    return {
      ...childDto(l.child, rooms),
      myRelation: l.relation,
      current: att
        ? { sessionLabel: att.session.label, roomName: att.room.name, checkInAt: att.checkInAt.toISOString(), checkOutAt: att.checkOutAt?.toISOString() ?? null }
        : null,
      unread: unreadRows.find((u) => u.childId === l.childId)?._count._all ?? 0,
    }
  })
}

// ── Servicios ────────────────────────────────────────────────────────────────

export interface SessionSummaryDto {
  id: string
  date: string
  endDate: string | null
  label: string
  kind: "service" | "event"
  location: string | null
  status: "open" | "closed"
  present: number
  total: number
}

export interface KidsOverviewDto {
  access: { canManage: boolean; canAuthorizeExit: boolean; memberId: string | null }
  rooms: RoomDto[]
  openSessions: SessionSummaryDto[]
  recent: SessionSummaryDto[]
  childCount: number
}

async function summarize(
  rows: {
    id: string
    date: Date
    endDate: Date | null
    label: string
    kind: string
    location: string | null
    status: "open" | "closed"
    attendance: { checkOutAt: Date | null }[]
  }[]
) {
  return rows.map<SessionSummaryDto>((s) => ({
    id: s.id,
    date: ymd(s.date),
    endDate: s.endDate ? ymd(s.endDate) : null,
    label: s.label,
    kind: s.kind === "event" ? "event" : "service",
    location: s.location,
    status: s.status,
    present: s.attendance.filter((a) => !a.checkOutAt).length,
    total: s.attendance.length,
  }))
}

export async function getOverview(actor: Actor, ministryId: string): Promise<KidsOverviewDto> {
  const a = await kidsMinistryAccess(actor, ministryId)
  const [rooms, open, recent, childCount, presentByRoom] = await Promise.all([
    ensureRooms(actor.organizationId),
    prisma.kidsSession.findMany({
      where: { organizationId: actor.organizationId, ministryId, status: "open" },
      include: { attendance: { select: { checkOutAt: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.kidsSession.findMany({
      where: { organizationId: actor.organizationId, ministryId, status: "closed" },
      include: { attendance: { select: { checkOutAt: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.kidsChild.count({ where: { organizationId: actor.organizationId, isActive: true } }),
    prisma.kidsAttendance.groupBy({
      by: ["roomId"],
      where: { organizationId: actor.organizationId, checkOutAt: null, session: { ministryId, status: "open" } },
      _count: { _all: true },
    }),
  ])
  return {
    access: { canManage: a.canManage, canAuthorizeExit: a.canAuthorizeExit, memberId: a.memberId },
    rooms: rooms.map((r) => ({ ...r, present: presentByRoom.find((p) => p.roomId === r.id)?._count._all ?? 0 })),
    openSessions: await summarize(open),
    recent: await summarize(recent),
    childCount,
  }
}

export async function openSession(
  actor: Actor,
  ministryId: string,
  input: { label?: unknown; kind?: unknown; date?: unknown; endDate?: unknown; location?: unknown }
) {
  const a = await kidsMinistryAccess(actor, ministryId)
  if (!a.canManage) throw new CrudError("Solo la dirección o el encargado del servicio puede abrirlo", 403)
  const kind = input.kind === "event" ? "event" : "service"
  const label = text(input.label, 60) ?? (kind === "event" ? "Evento" : "Servicio")
  // Un servicio es de hoy; un evento (campamento) puede abrirse para otra fecha o varios días.
  let date = todayUtc()
  let endDate: Date | null = null
  if (kind === "event") {
    if (input.date) {
      date = new Date(`${String(input.date).slice(0, 10)}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime())) throw new CrudError("Fecha de inicio inválida", 400, "date")
    }
    if (input.endDate) {
      endDate = new Date(`${String(input.endDate).slice(0, 10)}T00:00:00.000Z`)
      if (Number.isNaN(endDate.getTime()) || endDate < date) throw new CrudError("La fecha final no puede ser anterior al inicio", 400, "endDate")
    }
  }
  const location = kind === "event" ? text(input.location, 150) : null
  const existing = await prisma.kidsSession.findUnique({ where: { ministryId_date_label: { ministryId, date, label } } })
  if (existing) {
    if (existing.status === "open") return { id: existing.id }
    await prisma.kidsSession.update({ where: { id: existing.id }, data: { status: "open", closedAt: null } })
    return { id: existing.id }
  }
  const row = await prisma.kidsSession.create({
    data: { organizationId: actor.organizationId, ministryId, date, endDate, label, kind, location, openedByUserId: actor.userId },
  })
  return { id: row.id }
}

export interface AttendanceDto {
  id: string
  childId: string
  fullName: string
  ageLabel: string
  imageUrl: string | null
  indications: string | null
  section: "baby" | "child" | null
  roomId: string
  roomName: string
  checkInAt: string
  checkOutAt: string | null
  pickedUpBy: string | null
  checklist: Record<string, boolean>
  note: string | null
  unread: number
  guardians: { fullName: string; phone: string | null }[]
}

export interface SessionDetailDto {
  session: {
    id: string
    ministryId: string
    date: string
    endDate: string | null
    label: string
    kind: "service" | "event"
    location: string | null
    status: "open" | "closed"
  }
  attendance: AttendanceDto[]
  staff: { roomId: string; memberId: string; fullName: string; role: "teacher" | "support" }[]
  team: { memberId: string; fullName: string; role: string }[]
  rooms: RoomRange[]
  checklistItems: readonly string[]
  access: { canManage: boolean; canAuthorizeExit: boolean }
}

async function loadSession(actor: Actor, sessionId: string) {
  const session = await prisma.kidsSession.findFirst({ where: { id: sessionId, organizationId: actor.organizationId } })
  if (!session) throw new CrudError("Servicio no encontrado", 404)
  const a = await kidsMinistryAccess(actor, session.ministryId)
  return { session, a }
}

export async function getSession(actor: Actor, sessionId: string): Promise<SessionDetailDto> {
  const { session, a } = await loadSession(actor, sessionId)
  const [rooms, attendance, staff, team, unread] = await Promise.all([
    ensureRooms(actor.organizationId),
    prisma.kidsAttendance.findMany({
      where: { sessionId },
      include: {
        child: { include: childInclude },
        room: { select: { name: true, section: true } },
      },
      orderBy: { checkInAt: "asc" },
    }),
    prisma.kidsRoomStaff.findMany({ where: { sessionId }, include: { member: { select: { fullName: true } } } }),
    prisma.ministryMember.findMany({
      where: { organizationId: actor.organizationId, ministryId: session.ministryId, isActive: true },
      select: { memberId: true, role: true, member: { select: { fullName: true } } },
      orderBy: { member: { fullName: "asc" } },
    }),
    prisma.kidsMessage.groupBy({
      by: ["childId"],
      where: { organizationId: actor.organizationId, direction: "to_staff", readAt: null, sessionId },
      _count: { _all: true },
    }),
  ])
  return {
    session: {
      id: session.id,
      ministryId: session.ministryId,
      date: ymd(session.date),
      endDate: session.endDate ? ymd(session.endDate) : null,
      label: session.label,
      kind: session.kind === "event" ? "event" : "service",
      location: session.location,
      status: session.status,
    },
    attendance: attendance.map((t) => ({
      id: t.id,
      childId: t.childId,
      fullName: t.child.fullName,
      ageLabel: ageLabel(t.child.birthDate),
      imageUrl: t.child.imageUrl,
      indications: t.child.indications,
      section: t.room.section,
      roomId: t.roomId,
      roomName: t.room.name,
      checkInAt: t.checkInAt.toISOString(),
      checkOutAt: t.checkOutAt?.toISOString() ?? null,
      pickedUpBy: t.pickedUpBy,
      checklist: sanitizeChecklist(t.checklist),
      note: t.note,
      unread: unread.find((u) => u.childId === t.childId)?._count._all ?? 0,
      guardians: t.child.guardians.map((g) => ({ fullName: g.member.fullName, phone: g.member.phone })),
    })),
    staff: staff.map((s) => ({ roomId: s.roomId, memberId: s.memberId, fullName: s.member.fullName, role: s.role })),
    team: team.map((m) => ({ memberId: m.memberId, fullName: m.member.fullName, role: m.role })),
    rooms,
    checklistItems: BABY_CHECKLIST,
    access: { canManage: a.canManage, canAuthorizeExit: a.canAuthorizeExit },
  }
}

export async function closeSession(actor: Actor, sessionId: string) {
  const { session, a } = await loadSession(actor, sessionId)
  if (!a.canManage) throw new CrudError("Solo la dirección o el encargado del servicio puede cerrarlo", 403)
  const pending = await prisma.kidsAttendance.count({ where: { sessionId, checkOutAt: null } })
  if (pending > 0) {
    throw new CrudError(`Aún hay ${pending} niño${pending === 1 ? "" : "s"} sin salida registrada`, 409)
  }
  await prisma.kidsSession.update({ where: { id: session.id }, data: { status: "closed", closedAt: new Date() } })
  return { ok: true }
}

export async function assignRoomStaff(
  actor: Actor,
  sessionId: string,
  input: { roomId?: unknown; memberId?: unknown; role?: unknown; remove?: unknown }
) {
  const { session, a } = await loadSession(actor, sessionId)
  if (!a.canManage) throw new CrudError("Solo la dirección o el encargado del servicio puede asignar maestros", 403)
  const roomId = text(input.roomId, 40)
  const memberId = text(input.memberId, 40)
  if (!roomId || !memberId) throw new CrudError("Faltan datos", 400)
  const [room, ok] = await Promise.all([
    prisma.kidsRoom.findFirst({ where: { id: roomId, organizationId: actor.organizationId }, select: { id: true } }),
    prisma.ministryMember.findFirst({
      where: { organizationId: actor.organizationId, ministryId: session.ministryId, memberId, isActive: true },
      select: { id: true },
    }),
  ])
  if (!room) throw new CrudError("Salón no válido", 400, "roomId")
  if (!ok) throw new CrudError("La persona debe pertenecer al ministerio Kids", 400, "memberId")
  if (input.remove === true) {
    await prisma.kidsRoomStaff.deleteMany({ where: { sessionId, roomId, memberId } })
    return { ok: true }
  }
  const role = input.role === "support" ? "support" : "teacher"
  // Un maestro y un apoyo por salón: reemplaza al anterior del mismo papel.
  await prisma.$transaction([
    prisma.kidsRoomStaff.deleteMany({ where: { sessionId, roomId, role } }),
    prisma.kidsRoomStaff.deleteMany({ where: { sessionId, memberId } }),
    prisma.kidsRoomStaff.create({ data: { organizationId: actor.organizationId, sessionId, roomId, memberId, role } }),
  ])
  return { ok: true }
}

// ── Entrada y salida ─────────────────────────────────────────────────────────

/** Resuelve el niño por id o por lo que leyó el escáner. */
async function resolveChild(actor: Actor, input: { childId?: unknown; token?: unknown }) {
  const token = parseQrPayload(input.token)
  const childId = text(input.childId, 40)
  if (!token && !childId) throw new CrudError("Escanea el QR o elige al niño", 400)
  const child = await prisma.kidsChild.findFirst({
    where: { organizationId: actor.organizationId, ...(token ? { qrToken: token } : { id: childId! }) },
    include: childInclude,
  })
  if (!child) throw new CrudError(token ? "QR no reconocido" : "Niño no encontrado", 404)
  return child
}

export interface LookupDto {
  child: ChildDto
  state: "none" | "in" | "out"
  attendanceId: string | null
  roomId: string | null
  checklistItems: readonly string[]
}

/** Consulta para el escáner: quién es y en qué estado está dentro del servicio. */
export async function lookupChild(actor: Actor, sessionId: string, input: { childId?: unknown; token?: unknown }): Promise<LookupDto> {
  const { session } = await loadSession(actor, sessionId)
  const [rooms, child] = await Promise.all([ensureRooms(actor.organizationId), resolveChild(actor, input)])
  const att = await prisma.kidsAttendance.findUnique({ where: { sessionId_childId: { sessionId: session.id, childId: child.id } } })
  const dto = childDto(child, rooms)
  return {
    child: dto,
    state: !att ? "none" : att.checkOutAt ? "out" : "in",
    attendanceId: att?.id ?? null,
    roomId: att?.roomId ?? child.roomId ?? roomForAge(rooms, dto.ageMonths)?.id ?? null,
    checklistItems: BABY_CHECKLIST,
  }
}

async function notifyGuardians(organizationId: string, childId: string, title: string, body: string, kind: "info" | "alert") {
  const guardians = await prisma.kidsGuardian.findMany({
    where: { organizationId, childId, member: { userId: { not: null } } },
    select: { member: { select: { userId: true } } },
  })
  await Promise.all(
    guardians.map((g) =>
      persistNotification({
        organizationId,
        recipientUserId: g.member.userId,
        kind: "kids",
        title,
        body,
        severity: kind === "alert" ? "warning" : "info",
        link: "/mi/hijos",
        metadata: { childId },
      }).catch(() => null)
    )
  )
}

export async function checkIn(
  actor: Actor,
  sessionId: string,
  input: { childId?: unknown; token?: unknown; roomId?: unknown; checklist?: unknown; note?: unknown }
) {
  const { session } = await loadSession(actor, sessionId)
  if (session.status !== "open") throw new CrudError("El servicio está cerrado", 409)
  const [rooms, child] = await Promise.all([ensureRooms(actor.organizationId), resolveChild(actor, input)])
  if (!child.isActive) throw new CrudError("El niño está dado de baja", 409)
  const dto = childDto(child, rooms)

  const roomId = text(input.roomId, 40) ?? child.roomId ?? roomForAge(rooms, dto.ageMonths)?.id ?? null
  if (!roomId) throw new CrudError("No hay un salón para su edad; elige uno", 400, "roomId")
  const room = rooms.find((r) => r.id === roomId)
  if (!room) throw new CrudError("Salón no válido", 400, "roomId")

  const existing = await prisma.kidsAttendance.findUnique({ where: { sessionId_childId: { sessionId, childId: child.id } } })
  if (existing && !existing.checkOutAt) throw new CrudError(`${child.fullName} ya está dentro del servicio`, 409)
  if (existing) throw new CrudError(`${child.fullName} ya salió en este servicio`, 409)

  await prisma.kidsAttendance.create({
    data: {
      organizationId: actor.organizationId,
      sessionId,
      childId: child.id,
      roomId,
      checkInByUserId: actor.userId,
      checklist: room.section === "baby" ? sanitizeChecklist(input.checklist) : {},
      note: text(input.note, 300),
    },
  })
  await notifyGuardians(actor.organizationId, child.id, `${child.fullName} ya está en Kids`, `Salón: ${room.name}`, "info")
  return { childId: child.id, roomName: room.name }
}

export async function checkOut(actor: Actor, sessionId: string, input: { childId?: unknown; token?: unknown; pickedUpBy?: unknown }) {
  const { session, a } = await loadSession(actor, sessionId)
  // La salida la autoriza el personal con el permiso, no quien muestra el QR.
  if (!a.canAuthorizeExit) throw new CrudError("Necesitas el permiso para autorizar la salida de un niño", 403)
  const child = await resolveChild(actor, input)
  const att = await prisma.kidsAttendance.findUnique({ where: { sessionId_childId: { sessionId: session.id, childId: child.id } } })
  if (!att) throw new CrudError(`${child.fullName} no tiene entrada en este servicio`, 409)
  if (att.checkOutAt) throw new CrudError(`${child.fullName} ya salió`, 409)
  await prisma.kidsAttendance.update({
    where: { id: att.id },
    data: { checkOutAt: new Date(), checkOutByUserId: actor.userId, pickedUpBy: text(input.pickedUpBy, 80) },
  })
  await notifyGuardians(actor.organizationId, child.id, `${child.fullName} salió de Kids`, text(input.pickedUpBy, 80) ? `Lo recogió ${text(input.pickedUpBy, 80)}` : "Salida registrada", "info")
  return { childId: child.id }
}

// ── Mensajes y alertas ───────────────────────────────────────────────────────

export interface MessageDto {
  id: string
  direction: "to_parent" | "to_staff"
  kind: "message" | "alert"
  body: string
  createdAt: string
  /** true si lo escribió quien consulta (de su lado de la conversación). */
  mine: boolean
  read: boolean
}

export async function listMessages(actor: Actor, childId: string): Promise<MessageDto[]> {
  const { child, staff, isGuardian } = await childFor(actor, childId)
  const mySide: "to_parent" | "to_staff" = isGuardian && !staff.isStaff ? "to_staff" : "to_parent"
  const rows = await prisma.kidsMessage.findMany({
    where: { childId: child.id, organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  // Lo que me escribieron se marca leído al abrir la conversación.
  const incoming: "to_parent" | "to_staff" = mySide === "to_staff" ? "to_parent" : "to_staff"
  const unreadIds = rows.filter((m) => m.direction === incoming && !m.readAt).map((m) => m.id)
  if (unreadIds.length > 0) await prisma.kidsMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } })
  return rows
    .reverse()
    .map((m) => ({
      id: m.id,
      direction: m.direction,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      mine: m.direction === mySide,
      read: m.readAt !== null || unreadIds.includes(m.id),
    }))
}

export async function sendMessage(actor: Actor, childId: string, input: { body?: unknown; kind?: unknown; sessionId?: unknown }) {
  const { child, staff, isGuardian } = await childFor(actor, childId)
  const body = text(input.body, 1000)
  if (!body) throw new CrudError("Escribe el mensaje", 400, "body")
  const fromStaff = staff.isStaff
  if (!fromStaff && !isGuardian) throw new CrudError("Niño no encontrado", 404)
  const kind: "message" | "alert" = fromStaff && input.kind === "alert" ? "alert" : "message"
  const direction = fromStaff ? "to_parent" : "to_staff"

  let sessionId: string | null = null
  const rawSession = text(input.sessionId, 40)
  if (rawSession) {
    const s = await prisma.kidsSession.findFirst({ where: { id: rawSession, organizationId: actor.organizationId }, select: { id: true } })
    sessionId = s?.id ?? null
  }
  // Los padres escriben dentro del servicio en curso, si el niño está presente.
  if (!sessionId && direction === "to_staff") {
    const att = await prisma.kidsAttendance.findFirst({
      where: { childId: child.id, checkOutAt: null, session: { status: "open" } },
      select: { sessionId: true },
      orderBy: { checkInAt: "desc" },
    })
    sessionId = att?.sessionId ?? null
  }

  const msg = await prisma.kidsMessage.create({
    data: { organizationId: actor.organizationId, childId: child.id, sessionId, direction, kind, body, senderUserId: actor.userId },
    select: { id: true },
  })
  if (direction === "to_parent") {
    await notifyGuardians(
      actor.organizationId,
      child.id,
      kind === "alert" ? `Aviso de Kids sobre ${child.fullName}` : `Mensaje de Kids sobre ${child.fullName}`,
      body.slice(0, 140),
      kind === "alert" ? "alert" : "info"
    )
  }
  return { id: msg.id }
}

// ── Reporte de asistencia por salón ──────────────────────────────────────────

export interface KidsReportDto {
  month: string
  rooms: { id: string; name: string }[]
  sessions: { id: string; date: string; label: string; kind: "service" | "event"; total: number; byRoom: Record<string, number> }[]
  totalsByRoom: Record<string, number>
  totalAttendances: number
  uniqueChildren: number
  averagePerSession: number
}

/** Asistencia del mes: por servicio y salón (cuenta niños que dieron entrada). */
export async function getReport(actor: Actor, ministryId: string, month: string): Promise<KidsReportDto> {
  await kidsMinistryAccess(actor, ministryId)
  const m = /^(\d{4})-(\d{2})$/.exec(month) ?? /^(\d{4})-(\d{2})$/.exec(new Date().toISOString().slice(0, 7))!
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1))
  const [rooms, sessions] = await Promise.all([
    ensureRooms(actor.organizationId),
    prisma.kidsSession.findMany({
      where: { organizationId: actor.organizationId, ministryId, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, date: true, label: true, kind: true, attendance: { select: { roomId: true, childId: true } } },
    }),
  ])
  const totalsByRoom: Record<string, number> = {}
  const unique = new Set<string>()
  let totalAttendances = 0
  const rows = sessions.map((s) => {
    const byRoom: Record<string, number> = {}
    for (const a of s.attendance) {
      byRoom[a.roomId] = (byRoom[a.roomId] ?? 0) + 1
      totalsByRoom[a.roomId] = (totalsByRoom[a.roomId] ?? 0) + 1
      unique.add(a.childId)
      totalAttendances += 1
    }
    return { id: s.id, date: ymd(s.date), label: s.label, kind: s.kind === "event" ? ("event" as const) : ("service" as const), total: s.attendance.length, byRoom }
  })
  const usedRoomIds = new Set(Object.keys(totalsByRoom))
  return {
    month: `${m[1]}-${m[2]}`,
    rooms: rooms.filter((r) => r.isActive || usedRoomIds.has(r.id)).map((r) => ({ id: r.id, name: r.name })),
    sessions: rows,
    totalsByRoom,
    totalAttendances,
    uniqueChildren: unique.size,
    averagePerSession: rows.length === 0 ? 0 : Math.round((totalAttendances / rows.length) * 10) / 10,
  }
}
