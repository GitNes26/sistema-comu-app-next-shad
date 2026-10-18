import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { normalizePhone } from "@/lib/consolidation/rules"
import {
  DEFAULT_CELL_TYPES,
  MAX_LEADERS,
  MAX_SUPPORT,
  birthdaysOfMonth,
  canDecideTransfer,
  isCellRole,
  isValidDay,
  isValidTime,
  isVisionStage,
  lastOccurrenceInMonth,
  nextOccurrence,
  type Birthday,
  type CellRoleKey,
  type VisionStageKey,
} from "@/lib/cells/rules"

// Células y redes.
//
// Alcance por RELACIÓN (nunca por reasignar el rol base):
//  - Líder de la célula: edita su configuración, integrantes, reuniones y traspasos,
//    y ACTUALIZA EL AVANCE EN LA VISIÓN de sus integrantes (los creyentes no pueden
//    modificar su propio avance).
//  - Apoyo: pasa lista y registra reuniones.
//  - Encargado de la red (discípulo): ve y gestiona las células de su red.
//  - Integrante / anfitrión: ve su célula (sin datos de contacto de los demás).
//  - Permisos globales `cells.view` / `cells.manage` ven o gestionan todas;
//    `members.manage` también puede cambiar el avance de cualquiera.
// Una persona pertenece a una sola célula activa; cambiarla requiere un traspaso
// aprobado por la célula destino. Un líder puede llevar varias células.

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
const decimal = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

// ── Acceso ───────────────────────────────────────────────────────────────────

interface CellAccess {
  cell: NonNullable<Awaited<ReturnType<typeof loadCell>>>
  memberId: string | null
  myRole: CellRoleKey | null
  isNetworkLeader: boolean
  isHost: boolean
  canManage: boolean
  canTakeAttendance: boolean
  canUpdateStage: boolean
  canSeeRoster: boolean
}

function loadCell(organizationId: string, id: string) {
  return prisma.cell.findFirst({
    where: { id, organizationId },
    include: {
      type: { select: { id: true, name: true } },
      network: { select: { id: true, name: true, leaderMemberId: true } },
      host: { select: { id: true, fullName: true } },
    },
  })
}

async function cellAccess(actor: Actor, cellId: string): Promise<CellAccess> {
  const cell = await loadCell(actor.organizationId, cellId)
  if (!cell) throw new CrudError("Célula no encontrada", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const row = memberId
    ? await prisma.cellMember.findFirst({ where: { cellId, memberId, isActive: true }, select: { role: true } })
    : null
  const myRole = row?.role ?? null
  const isNetworkLeader = memberId !== null && cell.network?.leaderMemberId === memberId
  const isHost = memberId !== null && cell.hostMemberId === memberId
  const viewAll = Boolean(actor.canViewCells || actor.canManageCells)
  if (!viewAll && myRole === null && !isNetworkLeader && !isHost) throw new CrudError("Célula no encontrada", 404)
  const canManage = Boolean(actor.canManageCells) || isNetworkLeader || myRole === "leader"
  const canTakeAttendance = canManage || myRole === "support"
  return {
    cell,
    memberId,
    myRole,
    isNetworkLeader,
    isHost,
    canManage,
    canTakeAttendance,
    canUpdateStage: myRole === "leader" || Boolean(actor.canManageMembers),
    canSeeRoster: canTakeAttendance || viewAll,
  }
}

function assertManage(a: CellAccess) {
  if (!a.canManage) throw new CrudError("No tienes permiso para gestionar esta célula", 403)
}
function assertAttendance(a: CellAccess) {
  if (!a.canTakeAttendance) throw new CrudError("No tienes permiso para registrar reuniones de esta célula", 403)
}

// ── Catálogos: tipos y redes ─────────────────────────────────────────────────

export async function listTypes(actor: Actor) {
  const count = await prisma.cellType.count({ where: { organizationId: actor.organizationId } })
  if (count === 0) {
    await prisma.cellType.createMany({
      data: DEFAULT_CELL_TYPES.map((name, i) => ({ organizationId: actor.organizationId, name, sortOrder: i })),
    })
  }
  const rows = await prisma.cellType.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { cells: true } } },
  })
  return rows.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive, cellCount: t._count.cells }))
}

export async function saveType(actor: Actor, id: string | null, input: Record<string, unknown>) {
  if (!actor.canManageCells) throw new CrudError("No tienes permiso para configurar los tipos de célula", 403)
  const name = text(input.name, 60)
  if (!name) throw new CrudError("Escribe el nombre del tipo", 400, "name")
  const dup = await prisma.cellType.findFirst({
    where: { organizationId: actor.organizationId, name, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  })
  if (dup) throw new CrudError("Ya existe un tipo con ese nombre", 409, "name")
  if (id) {
    const r = await prisma.cellType.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: { name, ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}) },
    })
    if (r.count === 0) throw new CrudError("Tipo no encontrado", 404)
    return { id }
  }
  const row = await prisma.cellType.create({ data: { organizationId: actor.organizationId, name } })
  return { id: row.id }
}

export interface NetworkDto {
  id: string
  name: string
  description: string | null
  leaderMemberId: string | null
  leaderName: string | null
  isActive: boolean
  cellCount: number
  memberCount: number
}

export async function listNetworks(actor: Actor): Promise<NetworkDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const viewAll = Boolean(actor.canViewCells || actor.canManageCells)
  const rows = await prisma.cellNetwork.findMany({
    where: { organizationId: actor.organizationId, ...(viewAll ? {} : { leaderMemberId: memberId ?? "__none__" }) },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      leader: { select: { fullName: true } },
      cells: { where: { isActive: true }, select: { _count: { select: { members: { where: { isActive: true } } } } } },
    },
  })
  return rows.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    leaderMemberId: n.leaderMemberId,
    leaderName: n.leader?.fullName ?? null,
    isActive: n.isActive,
    cellCount: n.cells.length,
    memberCount: n.cells.reduce((sum, c) => sum + c._count.members, 0),
  }))
}

export async function saveNetwork(actor: Actor, id: string | null, input: Record<string, unknown>) {
  if (!actor.canManageCells) throw new CrudError("No tienes permiso para gestionar las redes", 403)
  const name = text(input.name, 100)
  if (!name) throw new CrudError("Escribe el nombre de la red", 400, "name")
  const dup = await prisma.cellNetwork.findFirst({
    where: { organizationId: actor.organizationId, name, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  })
  if (dup) throw new CrudError("Ya existe una red con ese nombre", 409, "name")
  let leaderMemberId: string | null | undefined
  if (input.leaderMemberId !== undefined) {
    leaderMemberId = text(input.leaderMemberId, 40)
    if (leaderMemberId) {
      const ok = await prisma.member.findFirst({
        where: { id: leaderMemberId, organizationId: actor.organizationId, isActive: true },
        select: { id: true },
      })
      if (!ok) throw new CrudError("El encargado no es un creyente de esta iglesia", 400, "leaderMemberId")
    }
  }
  const data = {
    name,
    description: input.description !== undefined ? text(input.description, 1000) : undefined,
    leaderMemberId,
    isActive: input.isActive !== undefined ? input.isActive !== false : undefined,
  }
  if (id) {
    const r = await prisma.cellNetwork.updateMany({ where: { id, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Red no encontrada", 404)
    return { id }
  }
  const row = await prisma.cellNetwork.create({
    data: { organizationId: actor.organizationId, name, description: data.description ?? null, leaderMemberId: leaderMemberId ?? null },
  })
  return { id: row.id }
}

// ── Listado de células ───────────────────────────────────────────────────────

export interface CellRowDto {
  id: string
  name: string
  typeName: string | null
  networkName: string | null
  dayOfWeek: number
  startTime: string
  leaders: string[]
  memberCount: number
  place: string | null
  myRole: CellRoleKey | null
  isActive: boolean
}

const rowInclude = {
  type: { select: { name: true } },
  network: { select: { name: true } },
  members: {
    where: { isActive: true },
    select: { memberId: true, role: true, member: { select: { fullName: true } } },
  },
} as const

export async function listCells(
  actor: Actor,
  filter: { scope: "mine" | "all"; q?: string; networkId?: string }
): Promise<CellRowDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const viewAll = Boolean(actor.canViewCells || actor.canManageCells)
  let scopeWhere: Record<string, unknown>
  if (filter.scope === "all") {
    if (viewAll) scopeWhere = {}
    else {
      // Encargado de red: solo las células de sus redes.
      if (!memberId) throw new CrudError("No tienes permiso para ver todas las células", 403)
      const nets = await prisma.cellNetwork.findMany({
        where: { organizationId: actor.organizationId, leaderMemberId: memberId },
        select: { id: true },
      })
      if (nets.length === 0) throw new CrudError("No tienes permiso para ver todas las células", 403)
      scopeWhere = { networkId: { in: nets.map((n) => n.id) } }
    }
  } else {
    if (!memberId) return []
    scopeWhere = {
      OR: [
        { members: { some: { memberId, isActive: true } } },
        { hostMemberId: memberId },
        { network: { leaderMemberId: memberId } },
      ],
    }
  }
  const q = filter.q?.trim()
  const rows = await prisma.cell.findMany({
    where: {
      organizationId: actor.organizationId,
      ...scopeWhere,
      ...(filter.networkId ? { networkId: filter.networkId } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    include: rowInclude,
    orderBy: [{ isActive: "desc" }, { dayOfWeek: "asc" }, { startTime: "asc" }, { name: "asc" }],
    take: 300,
  })
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    typeName: c.type?.name ?? null,
    networkName: c.network?.name ?? null,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    leaders: c.members.filter((m) => m.role === "leader").map((m) => m.member.fullName),
    memberCount: c.members.length,
    place: [c.neighborhood, c.city].filter(Boolean).join(", ") || null,
    myRole: c.members.find((m) => m.memberId === memberId)?.role ?? null,
    isActive: c.isActive,
  }))
}

// ── Detalle ──────────────────────────────────────────────────────────────────

export interface CellMemberDto {
  memberId: string
  fullName: string
  role: CellRoleKey
  phone: string | null
  imageUrl: string | null
  stage: VisionStageKey
  birthDate: string | null
}

export interface TransferDto {
  id: string
  memberName: string
  fromCellName: string
  toCellName: string
  reason: string | null
  createdAt: string
  /** Quien consulta puede decidirlo (gestiona la célula destino). */
  canDecide: boolean
}

export interface CellDetailDto {
  id: string
  name: string
  typeId: string | null
  typeName: string | null
  networkId: string | null
  networkName: string | null
  dayOfWeek: number
  startTime: string
  hostMemberId: string | null
  hostName: string | null
  street: string | null
  neighborhood: string | null
  city: string | null
  reference: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  isActive: boolean
  leaders: { memberId: string; fullName: string; role: CellRoleKey }[]
  memberCount: number
  /** Solo para quien gestiona o pasa lista; el integrante no ve los datos de los demás. */
  members: CellMemberDto[] | null
  birthdays: Birthday[]
  birthdayMonth: string
  celebrationDate: string
  nextMeeting: string
  nextTopic: string | null
  recentMeetings: { id: string; date: string; topic: string | null; present: number; total: number }[]
  transfers: TransferDto[]
  access: { myRole: CellRoleKey | null; canManage: boolean; canTakeAttendance: boolean; canUpdateStage: boolean; isNetworkLeader: boolean }
}

export async function getCell(actor: Actor, cellId: string, month?: string): Promise<CellDetailDto> {
  const a = await cellAccess(actor, cellId)
  const c = a.cell
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "") ?? /^(\d{4})-(\d{2})$/.exec(ymd(new Date()).slice(0, 7))!
  const year = Number(m[1])
  const monthIndex = Number(m[2]) - 1

  const [people, meetings, nextMeetingRow, transfers] = await Promise.all([
    prisma.cellMember.findMany({
      where: { cellId, isActive: true },
      include: { member: { select: { id: true, fullName: true, phone: true, imageUrl: true, visionStage: true, birthDate: true } } },
      orderBy: { member: { fullName: "asc" } },
    }),
    prisma.cellMeeting.findMany({
      where: { cellId },
      orderBy: { date: "desc" },
      take: 8,
      include: { attendance: { select: { present: true } } },
    }),
    prisma.cellMeeting.findFirst({
      where: { cellId, date: { gte: new Date(`${ymd(new Date())}T00:00:00.000Z`) } },
      orderBy: { date: "asc" },
      select: { date: true, topic: true },
    }),
    prisma.cellTransfer.findMany({
      where: { organizationId: actor.organizationId, status: "pending", OR: [{ toCellId: cellId }, { fromCellId: cellId }] },
      include: {
        member: { select: { fullName: true } },
        fromCell: { select: { name: true } },
        toCell: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const order = { leader: 0, support: 1, member: 2 } as const
  const roster: CellMemberDto[] = [...people]
    .sort((x, y) => order[x.role] - order[y.role] || x.member.fullName.localeCompare(y.member.fullName, "es"))
    .map((p) => ({
      memberId: p.memberId,
      fullName: p.member.fullName,
      role: p.role,
      phone: p.member.phone,
      imageUrl: p.member.imageUrl,
      stage: p.member.visionStage,
      birthDate: p.member.birthDate ? ymd(p.member.birthDate) : null,
    }))

  const birthdays = birthdaysOfMonth(
    people.map((p) => ({ memberId: p.memberId, fullName: p.member.fullName, birthDate: p.member.birthDate })),
    year,
    monthIndex
  )

  // ¿Quién puede decidir un traspaso entrante? Quien gestiona la célula destino.
  const canDecideHere = a.canManage
  const next = nextOccurrence(c.dayOfWeek)

  return {
    id: c.id,
    name: c.name,
    typeId: c.typeId,
    typeName: c.type?.name ?? null,
    networkId: c.networkId,
    networkName: c.network?.name ?? null,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    hostMemberId: c.hostMemberId,
    hostName: c.host?.fullName ?? c.hostName,
    street: c.street,
    neighborhood: c.neighborhood,
    city: c.city,
    reference: c.reference,
    latitude: c.latitude ? Number(c.latitude) : null,
    longitude: c.longitude ? Number(c.longitude) : null,
    notes: c.notes,
    isActive: c.isActive,
    leaders: roster.filter((r) => r.role !== "member").map((r) => ({ memberId: r.memberId, fullName: r.fullName, role: r.role })),
    memberCount: roster.length,
    members: a.canSeeRoster ? roster : null,
    birthdays,
    birthdayMonth: `${m[1]}-${m[2]}`,
    celebrationDate: ymd(lastOccurrenceInMonth(year, monthIndex, c.dayOfWeek)),
    nextMeeting: ymd(next),
    nextTopic: nextMeetingRow?.topic ?? null,
    recentMeetings: meetings.map((x) => ({
      id: x.id,
      date: ymd(x.date),
      topic: x.topic,
      present: x.attendance.filter((t) => t.present).length,
      total: x.attendance.length,
    })),
    transfers: a.canSeeRoster
      ? transfers.map((t) => ({
          id: t.id,
          memberName: t.member.fullName,
          fromCellName: t.fromCell.name,
          toCellName: t.toCell.name,
          reason: t.reason,
          createdAt: t.createdAt.toISOString(),
          canDecide: t.toCellId === cellId && canDecideHere,
        }))
      : [],
    access: {
      myRole: a.myRole,
      canManage: a.canManage,
      canTakeAttendance: a.canTakeAttendance,
      canUpdateStage: a.canUpdateStage,
      isNetworkLeader: a.isNetworkLeader,
    },
  }
}

// ── Alta y edición ───────────────────────────────────────────────────────────

interface CellInput {
  name?: unknown
  typeId?: unknown
  networkId?: unknown
  dayOfWeek?: unknown
  startTime?: unknown
  hostMemberId?: unknown
  hostName?: unknown
  street?: unknown
  neighborhood?: unknown
  city?: unknown
  reference?: unknown
  latitude?: unknown
  longitude?: unknown
  notes?: unknown
  isActive?: unknown
  leaderMemberIds?: unknown
}

async function parseCell(actor: Actor, input: CellInput, partial: boolean) {
  const out: Record<string, unknown> = {}
  if (!partial || input.name !== undefined) {
    const name = text(input.name, 120)
    if (!name) throw new CrudError("Escribe el nombre de la célula", 400, "name")
    out.name = name
  }
  if (!partial || input.dayOfWeek !== undefined) {
    const day = Number(input.dayOfWeek)
    if (!isValidDay(day)) throw new CrudError("Elige el día de la reunión", 400, "dayOfWeek")
    out.dayOfWeek = day
  }
  if (!partial || input.startTime !== undefined) {
    if (!isValidTime(input.startTime)) throw new CrudError("Hora inválida (HH:MM)", 400, "startTime")
    out.startTime = input.startTime
  }
  if (input.typeId !== undefined) {
    const id = text(input.typeId, 40)
    if (id && !(await prisma.cellType.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } }))) {
      throw new CrudError("Tipo de célula no válido", 400, "typeId")
    }
    out.typeId = id
  }
  if (input.networkId !== undefined) {
    const id = text(input.networkId, 40)
    if (id && !(await prisma.cellNetwork.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } }))) {
      throw new CrudError("Red no válida", 400, "networkId")
    }
    out.networkId = id
  }
  if (input.hostMemberId !== undefined) {
    const id = text(input.hostMemberId, 40)
    if (id && !(await prisma.member.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } }))) {
      throw new CrudError("Anfitrión no válido", 400, "hostMemberId")
    }
    out.hostMemberId = id
  }
  for (const k of ["hostName", "street", "neighborhood", "city", "reference"] as const) {
    if (input[k] !== undefined) out[k] = text(input[k], k === "reference" ? 255 : 150)
  }
  if (input.notes !== undefined) out.notes = text(input.notes, 2000)
  if (input.latitude !== undefined) out.latitude = decimal(input.latitude, -90, 90)
  if (input.longitude !== undefined) out.longitude = decimal(input.longitude, -180, 180)
  if (input.isActive !== undefined) out.isActive = input.isActive !== false
  return out
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

export async function createCell(actor: Actor, input: CellInput) {
  const data = await parseCell(actor, input, false)
  // Crear: permiso global o encargado de la red a la que pertenecerá.
  if (!actor.canManageCells) {
    const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
    const net = typeof data.networkId === "string" ? await prisma.cellNetwork.findFirst({ where: { id: data.networkId, leaderMemberId: memberId ?? "__none__" } }) : null
    if (!net) throw new CrudError("No tienes permiso para crear células", 403)
  }
  const leaderIds = Array.isArray(input.leaderMemberIds)
    ? [...new Set(input.leaderMemberIds.filter((x): x is string => typeof x === "string"))].slice(0, MAX_LEADERS)
    : []
  if (leaderIds.length > 0) {
    const found = await prisma.member.count({ where: { organizationId: actor.organizationId, id: { in: leaderIds }, isActive: true } })
    if (found !== leaderIds.length) throw new CrudError("Líder no válido", 400, "leaderMemberIds")
    const taken = await prisma.cellMember.findFirst({
      where: { memberId: { in: leaderIds }, isActive: true, cell: { isActive: true, organizationId: actor.organizationId } },
      select: { member: { select: { fullName: true } }, cell: { select: { name: true } } },
    })
    // Un líder puede llevar varias células, pero no ser integrante de otra como tal.
    if (taken) {
      const asLeader = await prisma.cellMember.findFirst({
        where: { memberId: { in: leaderIds }, isActive: true, role: { not: "leader" }, cell: { isActive: true } },
        select: { member: { select: { fullName: true } }, cell: { select: { name: true } } },
      })
      if (asLeader) throw new CrudError(`${asLeader.member.fullName} ya es integrante de «${asLeader.cell.name}»`, 409, "leaderMemberIds")
    }
  }
  try {
    const row = await prisma.cell.create({
      data: {
        organizationId: actor.organizationId,
        name: data.name as string,
        dayOfWeek: data.dayOfWeek as number,
        startTime: data.startTime as string,
        typeId: (data.typeId as string | null | undefined) ?? null,
        networkId: (data.networkId as string | null | undefined) ?? null,
        hostMemberId: (data.hostMemberId as string | null | undefined) ?? null,
        hostName: (data.hostName as string | null | undefined) ?? null,
        street: (data.street as string | null | undefined) ?? null,
        neighborhood: (data.neighborhood as string | null | undefined) ?? null,
        city: (data.city as string | null | undefined) ?? null,
        reference: (data.reference as string | null | undefined) ?? null,
        latitude: (data.latitude as number | null | undefined) ?? null,
        longitude: (data.longitude as number | null | undefined) ?? null,
        notes: (data.notes as string | null | undefined) ?? null,
        members: {
          create: leaderIds.map((memberId) => ({ organizationId: actor.organizationId, memberId, role: "leader" as const })),
        },
      },
      select: { id: true },
    })
    return { id: row.id }
  } catch (err) {
    if (isUniqueViolation(err)) throw new CrudError("Ya existe una célula con ese nombre", 409, "name")
    throw err
  }
}

export async function updateCell(actor: Actor, cellId: string, input: CellInput) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  const data = await parseCell(actor, input, true)
  // Cambiar de red o de tipo es decisión de la administración o del encargado de red.
  if ((data.networkId !== undefined && data.networkId !== a.cell.networkId) && !actor.canManageCells && !a.isNetworkLeader) {
    throw new CrudError("Solo la administración o el encargado de la red puede cambiar la red", 403)
  }
  if (Object.keys(data).length === 0) return { id: cellId }
  try {
    await prisma.cell.update({ where: { id: cellId }, data })
  } catch (err) {
    if (isUniqueViolation(err)) throw new CrudError("Ya existe una célula con ese nombre", 409, "name")
    throw err
  }
  return { id: cellId }
}

// ── Integrantes ──────────────────────────────────────────────────────────────

export async function searchCellCandidates(actor: Actor, cellId: string, q: string) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  const term = q.trim()
  return prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      cellMemberships: { none: { isActive: true, cell: { isActive: true } } },
      ...(term ? { OR: [{ fullName: { contains: term } }, { phone: { contains: term } }] } : {}),
    },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: "asc" },
    take: 20,
  })
}

async function assertRoleCapacity(cellId: string, role: CellRoleKey, exceptMemberId?: string) {
  if (role === "member") return
  const limit = role === "leader" ? MAX_LEADERS : MAX_SUPPORT
  const n = await prisma.cellMember.count({
    where: { cellId, isActive: true, role, ...(exceptMemberId ? { memberId: { not: exceptMemberId } } : {}) },
  })
  if (n >= limit) {
    throw new CrudError(role === "leader" ? "Una célula tiene como máximo 2 líderes" : "Una célula tiene un solo apoyo", 409, "role")
  }
}

export async function addCellMember(actor: Actor, cellId: string, input: { memberId?: unknown; role?: unknown }) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige a la persona", 400, "memberId")
  const role: CellRoleKey = isCellRole(input.role) ? input.role : "member"
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: actor.organizationId, isActive: true },
    select: { id: true, fullName: true },
  })
  if (!member) throw new CrudError("Persona no encontrada", 404)
  // Una sola célula activa por persona (salvo que ya la lidere): para cambiarla se pide un traspaso.
  const other = await prisma.cellMember.findFirst({
    where: { memberId, isActive: true, cellId: { not: cellId }, cell: { isActive: true } },
    select: { role: true, cell: { select: { name: true } } },
  })
  if (other && !(other.role === "leader" && role === "leader")) {
    throw new CrudError(`${member.fullName} ya pertenece a «${other.cell.name}». Solicita un traspaso.`, 409, "memberId")
  }
  await assertRoleCapacity(cellId, role, memberId)
  await prisma.cellMember.upsert({
    where: { cellId_memberId: { cellId, memberId } },
    update: { role, isActive: true },
    create: { organizationId: actor.organizationId, cellId, memberId, role },
  })
  return { ok: true }
}

export async function updateCellMemberRole(actor: Actor, cellId: string, memberId: string, input: { role?: unknown }) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  if (!isCellRole(input.role)) throw new CrudError("Papel inválido", 400, "role")
  await assertRoleCapacity(cellId, input.role, memberId)
  const r = await prisma.cellMember.updateMany({ where: { cellId, memberId, isActive: true }, data: { role: input.role } })
  if (r.count === 0) throw new CrudError("La persona no pertenece a la célula", 404)
  return { ok: true }
}

export async function removeCellMember(actor: Actor, cellId: string, memberId: string) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  const row = await prisma.cellMember.findFirst({ where: { cellId, memberId, isActive: true }, select: { role: true } })
  if (!row) throw new CrudError("La persona no pertenece a la célula", 404)
  if (row.role === "leader" && !actor.canManageCells) {
    const leaders = await prisma.cellMember.count({ where: { cellId, isActive: true, role: "leader" } })
    if (leaders <= 1) throw new CrudError("La célula no puede quedarse sin líder; asigna otro primero", 409)
  }
  await prisma.cellMember.updateMany({ where: { cellId, memberId }, data: { isActive: false } })
  return { ok: true }
}

// ── Avance en la visión (lo actualiza el líder, no el creyente) ──────────────

export async function setMemberStage(actor: Actor, cellId: string, memberId: string, input: { stage?: unknown; note?: unknown }) {
  const a = await cellAccess(actor, cellId)
  if (!a.canUpdateStage) throw new CrudError("Solo el líder de la célula puede actualizar el avance de sus integrantes", 403)
  if (!isVisionStage(input.stage)) throw new CrudError("Etapa inválida", 400, "stage")
  const row = await prisma.cellMember.findFirst({ where: { cellId, memberId, isActive: true }, select: { id: true } })
  if (!row) throw new CrudError("La persona no pertenece a la célula", 404)
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: actor.organizationId },
    select: { visionStage: true },
  })
  if (!member) throw new CrudError("Persona no encontrada", 404)
  if (member.visionStage === input.stage) return { ok: true }
  const stage = input.stage
  await prisma.$transaction([
    prisma.member.update({ where: { id: memberId }, data: { visionStage: stage } }),
    prisma.memberStageLog.create({
      data: {
        organizationId: actor.organizationId,
        memberId,
        stage,
        note: text(input.note, 255) ?? `Actualizado en la célula «${a.cell.name}»`,
        changedById: actor.userId,
      },
    }),
  ])
  return { ok: true }
}

// ── Reuniones y asistencia ───────────────────────────────────────────────────

export interface MeetingDetailDto {
  id: string | null
  cellId: string
  date: string
  topic: string | null
  topicUrl: string | null
  notes: string | null
  evidenceUrls: string[]
  attendance: { memberId: string; fullName: string; role: CellRoleKey; present: boolean; isNew: boolean; birthday: boolean }[]
}

const evidence = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^(https?:\/\/|\/)/.test(x)).slice(0, 12) : []

/** Detalle de una reunión (o la plantilla de una fecha sin registrar: todos presentes por marcar). */
export async function getMeeting(actor: Actor, cellId: string, dateRaw: string): Promise<MeetingDetailDto> {
  const a = await cellAccess(actor, cellId)
  assertAttendance(a)
  const date = toDate(dateRaw)
  if (!date) throw new CrudError("Fecha inválida", 400, "date")
  const [meeting, people] = await Promise.all([
    prisma.cellMeeting.findUnique({ where: { cellId_date: { cellId, date } }, include: { attendance: true } }),
    prisma.cellMember.findMany({
      where: { cellId, isActive: true },
      include: { member: { select: { fullName: true, birthDate: true } } },
      orderBy: { member: { fullName: "asc" } },
    }),
  ])
  const byMember = new Map(meeting?.attendance.map((t) => [t.memberId, t]) ?? [])
  const month = date.getUTCMonth()
  const known = new Set(people.map((p) => p.memberId))
  // Quien asistió y ya no está activo se conserva en el registro histórico.
  const former =
    meeting?.attendance.filter((t) => !known.has(t.memberId)) ?? []
  const formerNames = former.length
    ? await prisma.member.findMany({ where: { id: { in: former.map((f) => f.memberId) } }, select: { id: true, fullName: true, birthDate: true } })
    : []
  return {
    id: meeting?.id ?? null,
    cellId,
    date: ymd(date),
    topic: meeting?.topic ?? null,
    topicUrl: meeting?.topicUrl ?? null,
    notes: meeting?.notes ?? null,
    evidenceUrls: evidence(meeting?.evidenceUrls),
    attendance: [
      ...people.map((p) => ({
        memberId: p.memberId,
        fullName: p.member.fullName,
        role: p.role,
        present: byMember.get(p.memberId)?.present ?? false,
        isNew: byMember.get(p.memberId)?.isNew ?? false,
        birthday: p.member.birthDate?.getUTCMonth() === month,
      })),
      ...former.map((f) => {
        const m = formerNames.find((n) => n.id === f.memberId)
        return {
          memberId: f.memberId,
          fullName: m?.fullName ?? "Persona",
          role: "member" as const,
          present: f.present,
          isNew: f.isNew,
          birthday: m?.birthDate?.getUTCMonth() === month,
        }
      }),
    ],
  }
}

export async function saveMeeting(
  actor: Actor,
  cellId: string,
  input: { date?: unknown; topic?: unknown; topicUrl?: unknown; notes?: unknown; evidenceUrls?: unknown; presentMemberIds?: unknown; newMemberIds?: unknown }
) {
  const a = await cellAccess(actor, cellId)
  assertAttendance(a)
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha de la reunión", 400, "date")
  if (date.getTime() > Date.now() + 86_400_000) throw new CrudError("No se puede pasar lista de una fecha futura", 400, "date")
  const topicUrl = text(input.topicUrl, 500)
  if (topicUrl && !/^https?:\/\//.test(topicUrl)) throw new CrudError("El enlace del tema debe iniciar con http:// o https://", 400, "topicUrl")

  const present = new Set(Array.isArray(input.presentMemberIds) ? input.presentMemberIds.filter((x): x is string => typeof x === "string") : [])
  const fresh = new Set(Array.isArray(input.newMemberIds) ? input.newMemberIds.filter((x): x is string => typeof x === "string") : [])
  const people = await prisma.cellMember.findMany({ where: { cellId, isActive: true }, select: { memberId: true } })
  const valid = new Set(people.map((p) => p.memberId))

  const result = await prisma.$transaction(async (tx) => {
    const meeting = await tx.cellMeeting.upsert({
      where: { cellId_date: { cellId, date } },
      update: {
        topic: text(input.topic, 200),
        topicUrl,
        notes: text(input.notes, 2000),
        evidenceUrls: evidence(input.evidenceUrls),
      },
      create: {
        organizationId: actor.organizationId,
        cellId,
        date,
        topic: text(input.topic, 200),
        topicUrl,
        notes: text(input.notes, 2000),
        evidenceUrls: evidence(input.evidenceUrls),
        createdByUserId: actor.userId,
      },
      select: { id: true },
    })
    for (const memberId of valid) {
      await tx.cellAttendance.upsert({
        where: { meetingId_memberId: { meetingId: meeting.id, memberId } },
        update: { present: present.has(memberId), isNew: fresh.has(memberId) },
        create: {
          organizationId: actor.organizationId,
          meetingId: meeting.id,
          memberId,
          present: present.has(memberId),
          isNew: fresh.has(memberId),
        },
      })
    }
    return meeting
  })
  return { id: result.id }
}

export interface NewBelieverInput {
  fullName?: unknown
  phone?: unknown
  email?: unknown
  gender?: unknown
  birthDate?: unknown
  useExisting?: unknown
}

/** Registra a quien llegó por la célula: ficha de creyente, integrante y, si existe, caso de Consolidación. */
export async function registerNewBeliever(actor: Actor, cellId: string, input: NewBelieverInput) {
  const a = await cellAccess(actor, cellId)
  assertAttendance(a)
  const fullName = text(input.fullName, 150)
  if (!fullName) throw new CrudError("Escribe el nombre", 400, "fullName")
  const phone = text(input.phone, 30)
  const email = text(input.email, 150)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CrudError("Correo inválido", 400, "email")
  if (!phone && !email) throw new CrudError("Anota un teléfono o un correo", 400, "phone")
  const birthDate = input.birthDate ? toDate(input.birthDate) : null
  if (input.birthDate && (!birthDate || birthDate > new Date())) throw new CrudError("Fecha de nacimiento inválida", 400, "birthDate")
  const gender = input.gender === "male" || input.gender === "female" ? input.gender : null

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
  if (dupes[0]) {
    const other = await prisma.cellMember.findFirst({
      where: { memberId: dupes[0].id, isActive: true, cell: { isActive: true } },
      select: { cell: { select: { name: true, id: true } } },
    })
    if (other && other.cell.id !== cellId) throw new CrudError(`${dupes[0].fullName} ya pertenece a «${other.cell.name}»`, 409, "duplicate")
  }

  const consolidation = await prisma.ministry.findFirst({
    where: { organizationId: actor.organizationId, kind: "consolidation", isActive: true },
    select: { id: true },
  })
  const today = new Date(`${ymd(new Date())}T00:00:00.000Z`)

  return prisma.$transaction(async (tx) => {
    let memberId = dupes[0]?.id ?? null
    let created = false
    if (!memberId) {
      const m = await tx.member.create({
        data: {
          organizationId: actor.organizationId,
          fullName,
          phone,
          email,
          gender,
          birthDate,
          firstVisitAt: today,
          hierarchy: "believer",
          visionStage: "win",
          invitedByMemberId: a.memberId,
          invitedByName: a.memberId ? null : a.cell.name,
        },
        select: { id: true },
      })
      await tx.memberStageLog.create({
        data: { organizationId: actor.organizationId, memberId: m.id, stage: "win", note: `Llegó por la célula «${a.cell.name}»`, changedById: actor.userId },
      })
      memberId = m.id
      created = true
    }
    await tx.cellMember.upsert({
      where: { cellId_memberId: { cellId, memberId } },
      update: { isActive: true },
      create: { organizationId: actor.organizationId, cellId, memberId, role: "member" },
    })
    if (consolidation && created) {
      await tx.consolidationCase.upsert({
        where: { ministryId_memberId: { ministryId: consolidation.id, memberId } },
        update: {},
        create: {
          organizationId: actor.organizationId,
          ministryId: consolidation.id,
          memberId,
          visitedAt: today,
          serviceLabel: `Célula «${a.cell.name}»`,
          createdByUserId: actor.userId,
        },
      })
    }
    return { memberId, created }
  })
}

// ── Traspasos ────────────────────────────────────────────────────────────────

export async function requestTransfer(actor: Actor, input: { memberId?: unknown; fromCellId?: unknown; toCellId?: unknown; reason?: unknown }) {
  const fromCellId = text(input.fromCellId, 40)
  const toCellId = text(input.toCellId, 40)
  const memberId = text(input.memberId, 40)
  if (!fromCellId || !toCellId || !memberId) throw new CrudError("Faltan datos del traspaso", 400)
  if (fromCellId === toCellId) throw new CrudError("La célula destino debe ser distinta", 400, "toCellId")
  const from = await cellAccess(actor, fromCellId)
  assertManage(from)
  const [membership, dest] = await Promise.all([
    prisma.cellMember.findFirst({ where: { cellId: fromCellId, memberId, isActive: true }, select: { role: true } }),
    prisma.cell.findFirst({ where: { id: toCellId, organizationId: actor.organizationId, isActive: true }, select: { id: true } }),
  ])
  if (!membership) throw new CrudError("La persona no pertenece a la célula de origen", 404)
  if (!dest) throw new CrudError("Célula destino no encontrada", 404, "toCellId")
  const pending = await prisma.cellTransfer.findFirst({ where: { memberId, status: "pending" }, select: { id: true } })
  if (pending) throw new CrudError("Ya hay un traspaso pendiente para esa persona", 409)
  const row = await prisma.cellTransfer.create({
    data: {
      organizationId: actor.organizationId,
      memberId,
      fromCellId,
      toCellId,
      reason: text(input.reason, 300),
      requestedByUserId: actor.userId,
    },
    select: { id: true },
  })
  return { id: row.id }
}

export async function decideTransfer(actor: Actor, transferId: string, input: { decision?: unknown }) {
  const t = await prisma.cellTransfer.findFirst({ where: { id: transferId, organizationId: actor.organizationId } })
  if (!t) throw new CrudError("Traspaso no encontrado", 404)
  if (!canDecideTransfer(t.status)) throw new CrudError("Ese traspaso ya fue resuelto", 409)
  const decision = input.decision
  if (decision !== "approve" && decision !== "reject" && decision !== "cancel") throw new CrudError("Decisión inválida", 400)
  if (decision === "cancel") {
    const origin = await cellAccess(actor, t.fromCellId)
    assertManage(origin)
    await prisma.cellTransfer.update({ where: { id: t.id }, data: { status: "cancelled", decidedByUserId: actor.userId, decidedAt: new Date() } })
    return { ok: true }
  }
  // Lo decide quien gestiona la célula destino.
  const dest = await cellAccess(actor, t.toCellId)
  assertManage(dest)
  if (decision === "reject") {
    await prisma.cellTransfer.update({ where: { id: t.id }, data: { status: "rejected", decidedByUserId: actor.userId, decidedAt: new Date() } })
    return { ok: true }
  }
  await prisma.$transaction([
    prisma.cellMember.updateMany({ where: { cellId: t.fromCellId, memberId: t.memberId }, data: { isActive: false } }),
    prisma.cellMember.upsert({
      where: { cellId_memberId: { cellId: t.toCellId, memberId: t.memberId } },
      update: { isActive: true, role: "member" },
      create: { organizationId: actor.organizationId, cellId: t.toCellId, memberId: t.memberId, role: "member" },
    }),
    prisma.cellTransfer.update({ where: { id: t.id }, data: { status: "approved", decidedByUserId: actor.userId, decidedAt: new Date() } }),
  ])
  return { ok: true }
}

/** Células destino posibles para un traspaso (activas, distintas a la de origen). */
export async function listTransferTargets(actor: Actor, cellId: string) {
  const a = await cellAccess(actor, cellId)
  assertManage(a)
  const rows = await prisma.cell.findMany({
    where: { organizationId: actor.organizationId, isActive: true, id: { not: cellId } },
    select: { id: true, name: true, dayOfWeek: true, startTime: true },
    orderBy: { name: "asc" },
    take: 200,
  })
  return rows
}

// ── Hoja de seguimiento: acceso ──────────────────────────────────────────────

/** Quien ve la lista de la célula (líder, apoyo, encargado de red o permiso global) puede sacar su hoja. */
export async function cellSheetAccess(actor: Actor, cellId: string) {
  const a = await cellAccess(actor, cellId)
  if (!a.canSeeRoster) throw new CrudError("No tienes permiso para ver la lista de esta célula", 403)
  return a.cell
}

/** Células cuya hoja puede sacar la persona: todas con permiso global; si no, las que lidera, apoya o encabeza su red. */
export async function listSheetCellIds(actor: Actor, networkId?: string | null): Promise<string[]> {
  const base = { organizationId: actor.organizationId, isActive: true, ...(networkId ? { networkId } : {}) }
  if (actor.canViewCells || actor.canManageCells) {
    return (await prisma.cell.findMany({ where: base, select: { id: true }, orderBy: { name: "asc" } })).map((c) => c.id)
  }
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.cell.findMany({
    where: {
      ...base,
      OR: [
        { members: { some: { memberId, isActive: true, role: { in: ["leader", "support"] } } } },
        { network: { leaderMemberId: memberId } },
      ],
    },
    select: { id: true },
    orderBy: { name: "asc" },
  })
  return rows.map((c) => c.id)
}
