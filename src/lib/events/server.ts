import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { fireAndForget, notifyChurch, notifyMembers } from "@/lib/notifications/church"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import {
  attendeeMayChoose,
  audienceAllows,
  autoAssignSeat,
  capacityOfLayout,
  parseStoredLayout,
  sanitizeLayout,
  sellableSeats,
  staffMayAssign,
  ticketBalance,
  ticketStatusFor,
  type Layout,
  type Seat,
} from "@/lib/events/rules"
import { defaultVenueLayouts } from "@/lib/events/default-venues"
import { completeGrowthEvent, type GrowthResultDto } from "@/lib/school/growth"
import { GROWTH_EVENT_TEMPLATES, growthCheckForEventKind } from "@/lib/school/growth-rules"

// Eventos internos y externos con itinerario, boletaje y acomodo opcional.
//
//  - Gestionar (crear, editar, boletos, pagos, acomodo): permiso `events.manage` o
//    ser pastor o líder del grupo que organiza el evento (Jóvenes, Varones…): alcance por relación.
//  - Dar entrada con el QR del boleto: `events.checkin` (o gestionar).
//  - Cada creyente aparta su boleto si el evento lo permite y su público lo incluye;
//    elige lugar solo si el acomodo es por asientos y la selección lo admite.
//  - El lugar nunca se duplica (restricción única) y el cupo se valida en servidor.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null
}
const toDateTime = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const newCode = () => randomBytes(18).toString("base64url")
const isUnique = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"

// ── Acceso ───────────────────────────────────────────────────────────────────

export interface EventAccess {
  event: NonNullable<Awaited<ReturnType<typeof loadEvent>>>
  memberId: string | null
  canManage: boolean
  canCheckin: boolean
  canView: boolean
}

function loadEvent(organizationId: string, id: string) {
  return prisma.event.findFirst({
    where: { id, organizationId },
    include: {
      venue: { select: { id: true, name: true, layout: true, planWidth: true, planHeight: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      audiences: { select: { ministryId: true } },
      ownerMinistry: { select: { id: true, name: true } },
    },
  })
}

export async function eventAccess(actor: Actor, eventId: string): Promise<EventAccess> {
  const event = await loadEvent(actor.organizationId, eventId)
  if (!event) throw new CrudError("Evento no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  let canManage = Boolean(actor.canManageEvents)
  if (!canManage && event.ministryId) {
    try {
      canManage = (await ministryAccess(actor, event.ministryId)).canManage
    } catch {
      canManage = false
    }
  }
  const canCheckin = canManage || Boolean(actor.canCheckinEvents)
  const canView = canManage || canCheckin || Boolean(actor.canViewEvents)
  return { event, memberId, canManage, canCheckin, canView }
}
export function assertManage(a: EventAccess) {
  if (!a.canManage) throw new CrudError("No tienes permiso para gestionar este evento", 403)
}

// ── Áreas (planos) ───────────────────────────────────────────────────────────

export interface VenueDto {
  id: string
  name: string
  description: string | null
  kind: string
  planWidth: number
  planHeight: number
  layout: Layout
  capacity: number
  isActive: boolean
}

async function ensureVenues(organizationId: string) {
  const count = await prisma.venue.count({ where: { organizationId } })
  if (count > 0) return
  const defaults = defaultVenueLayouts()
  await prisma.venue.createMany({
    data: defaults.map((v, i) => ({
      organizationId,
      name: v.name,
      description: v.description,
      kind: v.kind,
      planWidth: v.planWidth,
      planHeight: v.planHeight,
      layout: v.layout as object,
      sortOrder: i,
    })),
  })
}

const venueDto = (v: { id: string; name: string; description: string | null; kind: string; planWidth: number; planHeight: number; layout: unknown; isActive: boolean }): VenueDto => {
  const layout = parseStoredLayout(v.layout)
  return { id: v.id, name: v.name, description: v.description, kind: v.kind, planWidth: v.planWidth, planHeight: v.planHeight, layout, capacity: capacityOfLayout(layout), isActive: v.isActive }
}

export async function listVenues(actor: Actor): Promise<VenueDto[]> {
  if (!actor.canViewEvents && !actor.canManageEvents && !actor.canCheckinEvents) {
    // Líderes de grupo también necesitan elegir el área al crear su evento.
    const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
    const leads = memberId
      ? await prisma.ministryMember.count({ where: { organizationId: actor.organizationId, memberId, isActive: true, role: "leader" } })
      : 0
    if (leads === 0) throw new CrudError("No tienes permiso para ver las áreas", 403)
  }
  await ensureVenues(actor.organizationId)
  const rows = await prisma.venue.findMany({ where: { organizationId: actor.organizationId }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] })
  return rows.map(venueDto)
}

export async function saveVenue(actor: Actor, id: string | null, input: Record<string, unknown>) {
  if (!actor.canManageEvents) throw new CrudError("Solo la administración puede configurar las áreas", 403)
  const name = text(input.name, 80)
  if (!name) throw new CrudError("Escribe el nombre del área", 400, "name")
  const planWidth = Math.min(4000, Math.max(300, Math.round(Number(input.planWidth) || 1000)))
  const planHeight = Math.min(4000, Math.max(200, Math.round(Number(input.planHeight) || 600)))
  let layout: Layout
  try {
    layout = sanitizeLayout(input.layout, planWidth, planHeight)
  } catch (err) {
    throw new CrudError(err instanceof Error ? err.message : "Plano inválido", 400, "layout")
  }
  const data = {
    name,
    description: text(input.description, 500),
    kind: ["auditorium", "kids", "other"].includes(String(input.kind)) ? String(input.kind) : "auditorium",
    planWidth,
    planHeight,
    layout: layout as object,
    ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
  }
  try {
    if (id) {
      const r = await prisma.venue.updateMany({ where: { id, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Área no encontrada", 404)
      return { id }
    }
    const row = await prisma.venue.create({ data: { ...data, organizationId: actor.organizationId } })
    return { id: row.id }
  } catch (err) {
    if (isUnique(err)) throw new CrudError("Ya existe un área con ese nombre", 409, "name")
    throw err
  }
}

// ── Eventos: listado y detalle ───────────────────────────────────────────────

export interface EventRowDto {
  id: string
  name: string
  kind: string
  scope: "internal" | "external"
  status: "draft" | "published" | "closed" | "cancelled"
  startsAt: string
  location: string | null
  venueName: string | null
  groupName: string | null
  price: number
  capacity: number | null
  taken: number
  imageUrl: string | null
  /** Para el listado del creyente. */
  myTicket: { id: string; status: "reserved" | "paid" | "cancelled"; seatCode: string | null } | null
  canRegister: boolean
}

const countable = { status: { not: "cancelled" as const } }

/** Cupo efectivo: el menor entre el cupo declarado y los asientos vendibles del plano. */
function effectiveCapacity(event: { capacity: number | null; seating: string; venue: { layout: unknown } | null }): number | null {
  const fromLayout = event.seating === "seats" && event.venue ? capacityOfLayout(parseStoredLayout(event.venue.layout)) : null
  if (event.capacity === null) return fromLayout
  return fromLayout === null ? event.capacity : Math.min(event.capacity, fromLayout)
}

interface PersonContext {
  memberId: string | null
  isLeader: boolean
  ministryIds: string[]
  /** Ministerios/grupos que lidera (o en los que es apoyo): alcance de gestión. */
  leadMinistryIds: string[]
}
async function personContext(actor: Actor): Promise<PersonContext> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return { memberId: null, isLeader: false, ministryIds: [], leadMinistryIds: [] }
  const rows = await prisma.ministryMember.findMany({
    where: { organizationId: actor.organizationId, memberId, isActive: true },
    select: { ministryId: true, role: true },
  })
  const cellLead = await prisma.cellMember.count({ where: { memberId, isActive: true, role: "leader" } })
  return {
    memberId,
    isLeader: cellLead > 0 || rows.some((r) => r.role === "leader"),
    ministryIds: rows.map((r) => r.ministryId),
    leadMinistryIds: rows.filter((r) => r.role === "leader").map((r) => r.ministryId),
  }
}

export async function listEvents(actor: Actor, filter: { scope: "all" | "mine"; upcoming?: boolean }): Promise<EventRowDto[]> {
  const ctx = await personContext(actor)
  const adminView = Boolean(actor.canViewEvents || actor.canManageEvents || actor.canCheckinEvents)
  if (filter.scope === "all" && !adminView) {
    // Líder de grupo: ve los eventos de su grupo.
    if (ctx.leadMinistryIds.length === 0) throw new CrudError("No tienes permiso para ver todos los eventos", 403)
  }
  const where =
    filter.scope === "all"
      ? adminView
        ? { organizationId: actor.organizationId }
        : { organizationId: actor.organizationId, ministryId: { in: ctx.leadMinistryIds } }
      : {
          organizationId: actor.organizationId,
          status: { in: ["published", "closed"] as ("published" | "closed")[] },
          ...(filter.upcoming ? { startsAt: { gte: new Date(Date.now() - 86_400_000) } } : {}),
        }
  const rows = await prisma.event.findMany({
    where,
    include: {
      venue: { select: { name: true, layout: true } },
      ownerMinistry: { select: { name: true } },
      audiences: { select: { ministryId: true } },
      tickets: { where: countable, select: { id: true, memberId: true, status: true, seatCode: true } },
    },
    orderBy: { startsAt: filter.scope === "mine" ? "asc" : "desc" },
    take: 200,
  })
  const out: EventRowDto[] = []
  for (const e of rows) {
    // El creyente solo ve los eventos de su público (aunque estén publicados).
    if (filter.scope === "mine" && !audienceAllows(e.audience, ctx, e.audiences.map((a) => a.ministryId)) && !e.tickets.some((t) => t.memberId === ctx.memberId)) continue
    const mine = ctx.memberId ? e.tickets.find((t) => t.memberId === ctx.memberId) : undefined
    const cap = effectiveCapacity(e)
    out.push({
      id: e.id,
      name: e.name,
      kind: e.kind,
      scope: e.scope,
      status: e.status,
      startsAt: e.startsAt.toISOString(),
      location: e.location,
      venueName: e.venue?.name ?? null,
      groupName: e.ownerMinistry?.name ?? null,
      price: Number(e.price),
      capacity: cap,
      taken: e.tickets.length,
      imageUrl: e.imageUrl,
      myTicket: mine ? { id: mine.id, status: mine.status, seatCode: mine.seatCode } : null,
      canRegister: e.status === "published" && e.selfRegistration && (cap === null || e.tickets.length < cap) && !mine,
    })
  }
  return out
}

export interface TicketDto {
  id: string
  code: string
  memberId: string | null
  name: string
  phone: string | null
  status: "reserved" | "paid" | "cancelled"
  price: number
  paid: number
  balance: number
  sectionId: string | null
  sectionName: string | null
  seatCode: string | null
  seatLabel: string | null
  notes: string | null
  checkedInAt: string | null
  payments: { id: string; amount: number; method: string; reference: string | null; note: string | null; paidAt: string }[]
}

export interface EventDetailDto {
  id: string
  ministryId: string | null
  groupName: string | null
  scope: "internal" | "external"
  kind: string
  name: string
  topic: string | null
  description: string | null
  imageUrl: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
  venueId: string | null
  venueName: string | null
  status: "draft" | "published" | "closed" | "cancelled"
  price: number
  capacity: number | null
  effectiveCapacity: number | null
  audience: "open" | "leaders" | "ministries"
  audienceMinistryIds: string[]
  seating: "free" | "sections" | "seats"
  seatSelection: "self" | "assigned" | "both"
  selfRegistration: boolean
  sections: { id: string; name: string; capacity: number; taken: number; layoutSectionId: string | null }[]
  /** Plano (solo con acomodo por asientos). */
  plan: { width: number; height: number; layout: Layout; takenSeats: string[]; mySeat: string | null } | null
  itinerary: ItineraryDto[]
  checklist: ChecklistDto[]
  stats: { reserved: number; paid: number; cancelled: number; checkedIn: number; taken: number; expected: number; collected: number; pending: number; expenses: number; net: number }
  /** Gastos del evento (solo quien lo gestiona); son el mismo registro que ve Finanzas. */
  expenses: ExpenseDto[]
  tickets: TicketDto[] | null
  myTicket: { id: string; code: string; status: "reserved" | "paid" | "cancelled"; seatCode: string | null; seatLabel: string | null; balance: number; checkedInAt: string | null; holderName: string; price: number } | null
  canRegister: boolean
  access: { canManage: boolean; canCheckin: boolean; mayChooseSeat: boolean; staffMayAssign: boolean }
}

export interface ExpenseDto {
  id: string
  concept: string
  category: string
  amount: number
  spentAt: string
  vendor: string | null
  receiptUrl: string | null
  paymentMethod: string | null
  notes: string | null
}

export interface ItineraryDto {
  id: string
  startsAt: string
  durationMin: number
  kind: "activity" | "clinic" | "break" | "meal"
  title: string
  speakerName: string | null
  location: string | null
  notes: string | null
}
export interface ChecklistDto {
  id: string
  itineraryId: string | null
  title: string
  isDone: boolean
}

export async function getEvent(actor: Actor, eventId: string): Promise<EventDetailDto> {
  const a = await eventAccess(actor, eventId)
  const e = a.event
  const ctx = await personContext(actor)
  const staff = a.canView || a.canManage
  const allowedMinistryIds = e.audiences.map((x) => x.ministryId)

  // Un creyente solo ve eventos publicados de su público (o aquel donde ya tiene boleto).
  const [expenseRows, tickets, itinerary, checklist] = await Promise.all([
    a.canManage ? prisma.expense.findMany({ where: { eventId, organizationId: actor.organizationId }, orderBy: { spentAt: "desc" } }) : Promise.resolve([]),
    prisma.eventTicket.findMany({
      where: { eventId },
      include: { member: { select: { fullName: true, phone: true } }, section: { select: { name: true } }, payments: { orderBy: { paidAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.eventItineraryItem.findMany({ where: { eventId }, orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }] }),
    prisma.eventChecklistItem.findMany({ where: { eventId }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
  ])
  const mine = ctx.memberId ? tickets.find((t) => t.memberId === ctx.memberId && t.status !== "cancelled") : undefined
  if (!staff && !a.canManage) {
    const visible = e.status !== "draft" && (audienceAllows(e.audience, ctx, allowedMinistryIds) || Boolean(mine))
    if (!visible) throw new CrudError("Evento no encontrado", 404)
  }

  const layout = e.venue && e.seating !== "free" ? parseStoredLayout(e.venue.layout) : null
  const seatsByCode = new Map<string, Seat>()
  if (layout) for (const s of sellableSeats(layout)) seatsByCode.set(s.code, s)
  const active = tickets.filter((t) => t.status !== "cancelled")
  const cap = effectiveCapacity(e)

  const toTicket = (t: (typeof tickets)[number]): TicketDto => {
    const paidList = t.payments.map((p) => Number(p.amount))
    const price = Number(t.price)
    return {
      id: t.id,
      code: t.code,
      memberId: t.memberId,
      name: t.member?.fullName ?? t.guestName ?? "Invitado",
      phone: t.member?.phone ?? t.guestPhone,
      status: t.status,
      price,
      paid: paidList.reduce((x, y) => x + y, 0),
      balance: ticketBalance(price, paidList),
      sectionId: t.sectionId,
      sectionName: t.section?.name ?? null,
      seatCode: t.seatCode,
      seatLabel: t.seatCode ? (seatsByCode.get(t.seatCode)?.label ?? t.seatCode) : null,
      notes: t.notes,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
      payments: t.payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, note: p.note, paidAt: p.paidAt.toISOString() })),
    }
  }
  const dtoTickets = tickets.map(toTicket)
  const activeDtos = dtoTickets.filter((t) => t.status !== "cancelled")
  const mineDto = mine ? dtoTickets.find((t) => t.id === mine.id) : undefined

  const mayChoose = attendeeMayChoose(e.seating, e.seatSelection)
  return {
    id: e.id,
    ministryId: e.ministryId,
    groupName: e.ownerMinistry?.name ?? null,
    scope: e.scope,
    kind: e.kind,
    name: e.name,
    topic: e.topic,
    description: e.description,
    imageUrl: e.imageUrl,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    location: e.location,
    venueId: e.venueId,
    venueName: e.venue?.name ?? null,
    status: e.status,
    price: Number(e.price),
    capacity: e.capacity,
    effectiveCapacity: cap,
    audience: e.audience,
    audienceMinistryIds: allowedMinistryIds,
    seating: e.seating,
    seatSelection: e.seatSelection,
    selfRegistration: e.selfRegistration,
    sections: e.sections.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      taken: active.filter((t) => t.sectionId === s.id).length,
      layoutSectionId: s.layoutSectionId,
    })),
    plan:
      layout && e.venue
        ? {
            width: e.venue.planWidth,
            height: e.venue.planHeight,
            layout,
            takenSeats: active.filter((t) => t.seatCode).map((t) => t.seatCode as string),
            mySeat: mine?.seatCode ?? null,
          }
        : null,
    itinerary: itinerary.map((i) => ({
      id: i.id,
      startsAt: i.startsAt.toISOString(),
      durationMin: i.durationMin,
      kind: i.kind,
      title: i.title,
      speakerName: i.speakerName,
      location: i.location,
      notes: i.notes,
    })),
    // El checklist de material es interno: solo lo ve quien gestiona.
    checklist: a.canManage ? checklist.map((c) => ({ id: c.id, itineraryId: c.itineraryId, title: c.title, isDone: c.isDone })) : [],
    stats: {
      reserved: activeDtos.filter((t) => t.status === "reserved").length,
      paid: activeDtos.filter((t) => t.status === "paid").length,
      cancelled: dtoTickets.filter((t) => t.status === "cancelled").length,
      checkedIn: activeDtos.filter((t) => t.checkedInAt).length,
      taken: activeDtos.length,
      expected: activeDtos.reduce((s, t) => s + t.price, 0),
      collected: activeDtos.reduce((s, t) => s + t.paid, 0),
      pending: activeDtos.reduce((s, t) => s + t.balance, 0),
      expenses: expenseRows.reduce((s, x) => s + Number(x.amount), 0),
      net: activeDtos.reduce((s, t) => s + t.paid, 0) - expenseRows.reduce((s, x) => s + Number(x.amount), 0),
    },
    expenses: expenseRows.map((x) => ({
      id: x.id,
      concept: x.concept,
      category: x.category,
      amount: Number(x.amount),
      spentAt: x.spentAt.toISOString().slice(0, 10),
      vendor: x.vendor,
      receiptUrl: x.receiptUrl,
      paymentMethod: x.paymentMethod,
      notes: x.notes,
    })),
    tickets: a.canView ? dtoTickets : null,
    myTicket: mineDto
      ? { id: mineDto.id, code: mineDto.code, status: mineDto.status, seatCode: mineDto.seatCode, seatLabel: mineDto.seatLabel, balance: mineDto.balance, checkedInAt: mineDto.checkedInAt, holderName: mineDto.name, price: mineDto.price }
      : null,
    canRegister:
      e.status === "published" &&
      e.selfRegistration &&
      !mine &&
      (cap === null || active.length < cap) &&
      audienceAllows(e.audience, ctx, allowedMinistryIds),
    access: { canManage: a.canManage, canCheckin: a.canCheckin, mayChooseSeat: mayChoose, staffMayAssign: staffMayAssign(e.seating, e.seatSelection) },
  }
}

// ── Alta y edición del evento ────────────────────────────────────────────────

export interface EventInput {
  ministryId?: unknown
  scope?: unknown
  kind?: unknown
  name?: unknown
  topic?: unknown
  description?: unknown
  imageUrl?: unknown
  startsAt?: unknown
  endsAt?: unknown
  location?: unknown
  venueId?: unknown
  price?: unknown
  capacity?: unknown
  audience?: unknown
  audienceMinistryIds?: unknown
  seating?: unknown
  seatSelection?: unknown
  selfRegistration?: unknown
  sections?: unknown
}

async function parseEvent(actor: Actor, input: EventInput) {
  const name = text(input.name, 150)
  if (!name) throw new CrudError("Escribe el nombre del evento", 400, "name")
  const startsAt = toDateTime(input.startsAt)
  if (!startsAt) throw new CrudError("Elige la fecha y hora", 400, "startsAt")
  const endsAt = input.endsAt ? toDateTime(input.endsAt) : null
  if (input.endsAt && (!endsAt || endsAt < startsAt)) throw new CrudError("El fin no puede ser anterior al inicio", 400, "endsAt")
  const scope: "internal" | "external" = input.scope === "external" ? "external" : "internal"
  const price = input.price === undefined || input.price === "" ? 0 : money(input.price)
  if (price === null) throw new CrudError("Costo inválido", 400, "price")
  let capacity: number | null = null
  if (input.capacity !== undefined && input.capacity !== null && input.capacity !== "") {
    const n = Number(input.capacity)
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw new CrudError("Cupo inválido", 400, "capacity")
    capacity = n
  }
  const audience = input.audience === "leaders" || input.audience === "ministries" ? input.audience : "open"
  const seating = scope === "internal" && (input.seating === "sections" || input.seating === "seats") ? input.seating : "free"
  const seatSelection = input.seatSelection === "self" || input.seatSelection === "assigned" ? input.seatSelection : "both"

  let venueId: string | null = null
  if (scope === "internal" && input.venueId) {
    const v = await prisma.venue.findFirst({ where: { id: String(input.venueId), organizationId: actor.organizationId }, select: { id: true } })
    if (!v) throw new CrudError("Área no válida", 400, "venueId")
    venueId = v.id
  }
  if (seating === "seats" && !venueId) throw new CrudError("Para acomodo por asientos elige el área con su plano", 400, "venueId")

  let ministryId: string | null = null
  if (input.ministryId) {
    const m = await prisma.ministry.findFirst({ where: { id: String(input.ministryId), organizationId: actor.organizationId }, select: { id: true } })
    if (!m) throw new CrudError("Grupo no válido", 400, "ministryId")
    ministryId = m.id
  }
  const audienceMinistryIds = Array.isArray(input.audienceMinistryIds)
    ? [...new Set(input.audienceMinistryIds.filter((x): x is string => typeof x === "string"))].slice(0, 30)
    : []
  if (audience === "ministries") {
    if (audienceMinistryIds.length === 0) throw new CrudError("Elige los ministerios del público", 400, "audienceMinistryIds")
    const n = await prisma.ministry.count({ where: { organizationId: actor.organizationId, id: { in: audienceMinistryIds } } })
    if (n !== audienceMinistryIds.length) throw new CrudError("Ministerio no válido", 400, "audienceMinistryIds")
  }

  const sections = Array.isArray(input.sections)
    ? input.sections.slice(0, 20).map((s, i) => {
        const o = (s ?? {}) as Record<string, unknown>
        const secName = text(o.name, 60)
        const cap = Number(o.capacity)
        if (!secName || !Number.isInteger(cap) || cap < 1) throw new CrudError("Cada sección necesita nombre y cupo", 400, "sections")
        return { name: secName, capacity: cap, sortOrder: i, layoutSectionId: text(o.layoutSectionId, 40) }
      })
    : []
  if (seating === "sections" && sections.length === 0) throw new CrudError("Agrega al menos una sección con su cupo", 400, "sections")

  return {
    data: {
      ministryId,
      scope,
      kind: text(input.kind, 40) ?? "general",
      name,
      topic: text(input.topic, 200),
      description: text(input.description, 4000),
      imageUrl: text(input.imageUrl, 500),
      startsAt,
      endsAt,
      location: text(input.location, 200),
      venueId,
      price,
      capacity,
      audience,
      seating,
      seatSelection,
      selfRegistration: input.selfRegistration !== false,
    } as const,
    audienceMinistryIds: audience === "ministries" ? audienceMinistryIds : [],
    sections: seating === "sections" ? sections : [],
  }
}

/** Crear: administración o pastor/líder del grupo organizador. */
export async function createEvent(actor: Actor, input: EventInput) {
  const parsed = await parseEvent(actor, input)
  let allowed = Boolean(actor.canManageEvents)
  if (!allowed && parsed.data.ministryId) {
    try {
      allowed = (await ministryAccess(actor, parsed.data.ministryId)).canManage
    } catch {
      allowed = false
    }
  }
  if (!allowed) throw new CrudError("No tienes permiso para crear eventos", 403)
  const row = await prisma.event.create({
    data: {
      ...parsed.data,
      organizationId: actor.organizationId,
      createdByUserId: actor.userId,
      audiences: { create: parsed.audienceMinistryIds.map((ministryId) => ({ organizationId: actor.organizationId, ministryId })) },
      sections: { create: parsed.sections.map((s) => ({ ...s, organizationId: actor.organizationId })) },
    },
    select: { id: true },
  })
  // Los eventos del camino (bautizo, encuentro, lanzamiento) siempre llevan la misma estructura.
  const check = growthCheckForEventKind(parsed.data.kind)
  if (check) {
    await prisma.eventChecklistItem.createMany({
      data: GROWTH_EVENT_TEMPLATES[check].checklist.map((title, i) => ({ organizationId: actor.organizationId, eventId: row.id, title, sortOrder: i })),
    })
  }
  return { id: row.id }
}

export async function updateEvent(actor: Actor, eventId: string, input: EventInput) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const parsed = await parseEvent(actor, input)
  // Con boletos con lugar, el modo de acomodo y el área no cambian a la ligera.
  const withSeats = await prisma.eventTicket.count({ where: { eventId, status: { not: "cancelled" }, OR: [{ seatCode: { not: null } }, { sectionId: { not: null } }] } })
  if (withSeats > 0 && (parsed.data.seating !== a.event.seating || parsed.data.venueId !== a.event.venueId)) {
    throw new CrudError("Ya hay boletos con lugar asignado; libéralos antes de cambiar el acomodo o el área", 409, "seating")
  }
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: parsed.data })
    await tx.eventAudienceMinistry.deleteMany({ where: { eventId } })
    if (parsed.audienceMinistryIds.length > 0) {
      await tx.eventAudienceMinistry.createMany({
        data: parsed.audienceMinistryIds.map((ministryId) => ({ organizationId: actor.organizationId, eventId, ministryId })),
      })
    }
    // Secciones: se conservan las que tienen boletos (por nombre) y se ajusta su cupo.
    const existing = await tx.eventSection.findMany({ where: { eventId } })
    const keepNames = new Set(parsed.sections.map((s) => s.name))
    for (const old of existing) {
      if (!keepNames.has(old.name)) {
        const used = await tx.eventTicket.count({ where: { sectionId: old.id, status: { not: "cancelled" } } })
        if (used > 0) throw new CrudError(`La sección «${old.name}» tiene boletos; no se puede quitar`, 409, "sections")
        await tx.eventSection.delete({ where: { id: old.id } })
      }
    }
    for (const s of parsed.sections) {
      const found = existing.find((o) => o.name === s.name)
      if (found) await tx.eventSection.update({ where: { id: found.id }, data: { capacity: s.capacity, sortOrder: s.sortOrder, layoutSectionId: s.layoutSectionId } })
      else await tx.eventSection.create({ data: { ...s, organizationId: actor.organizationId, eventId } })
    }
  })
  return { id: eventId }
}

export async function setEventStatus(actor: Actor, eventId: string, input: { status?: unknown }) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const status = input.status
  if (status !== "draft" && status !== "published" && status !== "closed" && status !== "cancelled") throw new CrudError("Estado inválido", 400, "status")
  const wasPublished = a.event.status === "published"
  await prisma.event.update({ where: { id: eventId }, data: { status } })
  // Un evento abierto a todos se anuncia al publicarse (no al reabrirse ni al cerrar).
  if (status === "published" && !wasPublished && a.event.audience === "open" && a.event.selfRegistration && a.event.status === "draft") {
    fireAndForget(
      notifyChurch(actor.organizationId, {
        kind: "event",
        title: `Nuevo evento: ${a.event.name}`.slice(0, 120),
        body: "Aparta tu lugar desde Eventos.",
        link: `/mi/eventos/${eventId}`,
        excludeUserId: actor.userId,
      })
    )
  }
  return { ok: true }
}

// ── Itinerario y checklist ───────────────────────────────────────────────────

export async function saveItineraryItem(actor: Actor, eventId: string, id: string | null, input: Record<string, unknown>) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el nombre de la actividad", 400, "title")
  const startsAt = toDateTime(input.startsAt)
  if (!startsAt) throw new CrudError("Elige la hora de inicio", 400, "startsAt")
  const durationMin = Number(input.durationMin)
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 24 * 60) throw new CrudError("Duración inválida (minutos)", 400, "durationMin")
  const kind = ["activity", "clinic", "break", "meal"].includes(String(input.kind)) ? (String(input.kind) as "activity" | "clinic" | "break" | "meal") : "activity"
  const data = { title, startsAt, durationMin, kind, speakerName: text(input.speakerName, 150), location: text(input.location, 150), notes: text(input.notes, 1000) }
  if (id) {
    const r = await prisma.eventItineraryItem.updateMany({ where: { id, eventId, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Actividad no encontrada", 404)
    return { id }
  }
  const row = await prisma.eventItineraryItem.create({ data: { ...data, organizationId: actor.organizationId, eventId } })
  return { id: row.id }
}

export async function deleteItineraryItem(actor: Actor, eventId: string, id: string) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const r = await prisma.eventItineraryItem.deleteMany({ where: { id, eventId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Actividad no encontrada", 404)
  return { ok: true }
}

export async function addChecklistItem(actor: Actor, eventId: string, input: { title?: unknown; itineraryId?: unknown }) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el material o pendiente", 400, "title")
  let itineraryId: string | null = null
  if (input.itineraryId) {
    const it = await prisma.eventItineraryItem.findFirst({ where: { id: String(input.itineraryId), eventId }, select: { id: true } })
    if (!it) throw new CrudError("Actividad no válida", 400, "itineraryId")
    itineraryId = it.id
  }
  const row = await prisma.eventChecklistItem.create({ data: { organizationId: actor.organizationId, eventId, itineraryId, title } })
  return { id: row.id }
}

export async function updateChecklistItem(actor: Actor, eventId: string, id: string, input: { isDone?: unknown; remove?: unknown }) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  if (input.remove === true) {
    await prisma.eventChecklistItem.deleteMany({ where: { id, eventId, organizationId: actor.organizationId } })
    return { ok: true }
  }
  const done = input.isDone === true
  const r = await prisma.eventChecklistItem.updateMany({
    where: { id, eventId, organizationId: actor.organizationId },
    data: { isDone: done, doneAt: done ? new Date() : null, doneByUserId: done ? actor.userId : null },
  })
  if (r.count === 0) throw new CrudError("Elemento no encontrado", 404)
  return { ok: true }
}

// ── Boletos ──────────────────────────────────────────────────────────────────

async function seatContext(eventId: string, event: EventAccess["event"]) {
  const layout = event.venue && event.seating === "seats" ? parseStoredLayout(event.venue.layout) : null
  const seats = layout ? sellableSeats(layout) : []
  const taken = new Set(
    (await prisma.eventTicket.findMany({ where: { eventId, status: { not: "cancelled" }, seatCode: { not: null } }, select: { seatCode: true } })).map((t) => t.seatCode as string)
  )
  return { seats, taken }
}

async function assertCapacity(event: EventAccess["event"], sectionId: string | null, exceptTicketId?: string) {
  const cap = effectiveCapacity(event)
  const total = await prisma.eventTicket.count({ where: { eventId: event.id, status: { not: "cancelled" }, ...(exceptTicketId ? { id: { not: exceptTicketId } } : {}) } })
  if (cap !== null && total >= cap) throw new CrudError("El evento ya no tiene lugares disponibles", 409)
  if (event.seating === "sections") {
    if (!sectionId) throw new CrudError("Elige la sección", 400, "sectionId")
    const section = event.sections.find((s) => s.id === sectionId)
    if (!section) throw new CrudError("Sección no válida", 400, "sectionId")
    const used = await prisma.eventTicket.count({ where: { eventId: event.id, sectionId, status: { not: "cancelled" }, ...(exceptTicketId ? { id: { not: exceptTicketId } } : {}) } })
    if (used >= section.capacity) throw new CrudError(`La sección «${section.name}» está llena`, 409, "sectionId")
  }
}

export interface TicketInput {
  memberId?: unknown
  guestName?: unknown
  guestPhone?: unknown
  price?: unknown
  sectionId?: unknown
  seatCode?: unknown
  autoAssign?: unknown
  notes?: unknown
}

async function placeTicket(event: EventAccess["event"], eventId: string, input: { sectionId?: unknown; seatCode?: unknown; autoAssign?: unknown }, allowPick: boolean) {
  let sectionId: string | null = null
  let seatCode: string | null = null
  if (event.seating === "sections") {
    sectionId = text(input.sectionId, 40)
  } else if (event.seating === "seats") {
    const { seats, taken } = await seatContext(eventId, event)
    const wanted = text(input.seatCode, 20)
    if (wanted) {
      if (!allowPick) throw new CrudError("En este evento el lugar lo asigna el personal", 403, "seatCode")
      const seat = seats.find((s) => s.code === wanted)
      if (!seat) throw new CrudError("Ese asiento no existe o no está disponible para venta", 400, "seatCode")
      if (taken.has(wanted)) throw new CrudError("Ese lugar ya está ocupado", 409, "seatCode")
      seatCode = wanted
    } else if (input.autoAssign === true) {
      const pick = autoAssignSeat(seats, taken)
      if (!pick) throw new CrudError("No quedan asientos disponibles", 409)
      seatCode = pick.code
    }
  }
  return { sectionId, seatCode }
}

/** El personal emite un boleto (miembro o invitado). */
export async function createTicket(actor: Actor, eventId: string, input: TicketInput) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const e = a.event
  if (e.status === "cancelled" || e.status === "closed") throw new CrudError("El evento ya no vende boletos", 409)
  const memberId = text(input.memberId, 40)
  let guestName: string | null = null
  if (memberId) {
    const m = await prisma.member.findFirst({ where: { id: memberId, organizationId: actor.organizationId, isActive: true }, select: { id: true } })
    if (!m) throw new CrudError("Persona no encontrada", 404, "memberId")
    const dup = await prisma.eventTicket.findFirst({ where: { eventId, memberId, status: { not: "cancelled" } }, select: { id: true } })
    if (dup) throw new CrudError("Esa persona ya tiene boleto para este evento", 409, "memberId")
    await assertNotBaptized(e.kind, memberId)
  } else {
    guestName = text(input.guestName, 150)
    if (!guestName) throw new CrudError("Escribe el nombre del invitado o elige a un creyente", 400, "guestName")
  }
  const place = await placeTicket(e, eventId, input, true)
  await assertCapacity(e, place.sectionId)
  const price = input.price === undefined || input.price === "" ? Number(e.price) : money(input.price)
  if (price === null) throw new CrudError("Costo inválido", 400, "price")
  try {
    const row = await prisma.eventTicket.create({
      data: {
        organizationId: actor.organizationId,
        eventId,
        code: newCode(),
        memberId,
        guestName,
        guestPhone: text(input.guestPhone, 30),
        price,
        status: ticketStatusFor(price, []),
        sectionId: place.sectionId,
        seatCode: place.seatCode,
        notes: text(input.notes, 300),
        createdByUserId: actor.userId,
      },
      select: { id: true },
    })
    // Quien recibe un boleto de parte de la iglesia lo ve al momento en su bandeja.
    if (memberId) {
      fireAndForget(
        notifyMembers(actor.organizationId, [memberId], {
          kind: "event_ticket",
          title: `Tienes boleto para ${e.name}`,
          body: place.seatCode ? `Lugar ${place.seatCode}` : "Muéstralo en la entrada.",
          link: `/mi/eventos/${eventId}`,
          severity: "success",
          excludeUserId: actor.userId,
        })
      )
    }
    return { id: row.id }
  } catch (err) {
    if (isUnique(err)) throw new CrudError("Ese lugar acaba de ocuparse", 409, "seatCode")
    throw err
  }
}

/** El creyente aparta su propio boleto. */
export async function reserveMyTicket(actor: Actor, eventId: string, input: { sectionId?: unknown; seatCode?: unknown }) {
  const a = await eventAccess(actor, eventId)
  const e = a.event
  const ctx = await personContext(actor)
  if (!ctx.memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente; pide a la secretaría que la vincule", 409)
  if (e.status !== "published" || !e.selfRegistration) throw new CrudError("Este evento no admite registro en línea", 403)
  if (!audienceAllows(e.audience, ctx, e.audiences.map((x) => x.ministryId))) throw new CrudError("Evento no encontrado", 404)
  const dup = await prisma.eventTicket.findFirst({ where: { eventId, memberId: ctx.memberId, status: { not: "cancelled" } }, select: { id: true } })
  if (dup) throw new CrudError("Ya tienes boleto para este evento", 409)
  await assertNotBaptized(e.kind, ctx.memberId)

  const mayChoose = attendeeMayChoose(e.seating, e.seatSelection)
  const wantsSeat = Boolean(text(input.seatCode, 20))
  if (e.seating === "seats" && !mayChoose && wantsSeat) throw new CrudError("En este evento el lugar lo asigna el personal", 403, "seatCode")
  // Si el acomodo es por asientos y la selección es del personal, se asigna después.
  const place = await placeTicket(e, eventId, { ...input, autoAssign: false }, mayChoose)
  await assertCapacity(e, place.sectionId)
  const price = Number(e.price)
  try {
    const row = await prisma.eventTicket.create({
      data: {
        organizationId: actor.organizationId,
        eventId,
        code: newCode(),
        memberId: ctx.memberId,
        price,
        status: ticketStatusFor(price, []),
        sectionId: place.sectionId,
        seatCode: place.seatCode,
        createdByUserId: actor.userId,
      },
      select: { id: true },
    })
    return { id: row.id }
  } catch (err) {
    if (isUnique(err)) throw new CrudError("Ese lugar acaba de ocuparse; elige otro", 409, "seatCode")
    throw err
  }
}

async function loadTicket(actor: Actor, eventId: string, ticketId: string) {
  const a = await eventAccess(actor, eventId)
  const t = await prisma.eventTicket.findFirst({ where: { id: ticketId, eventId, organizationId: actor.organizationId }, include: { payments: true } })
  if (!t) throw new CrudError("Boleto no encontrado", 404)
  return { a, t }
}

/** Cambia el lugar, el precio o las notas (personal) o el lugar propio (dueño si puede elegir). */
export async function updateTicket(actor: Actor, eventId: string, ticketId: string, input: TicketInput) {
  const { a, t } = await loadTicket(actor, eventId, ticketId)
  const e = a.event
  const isOwner = a.memberId !== null && t.memberId === a.memberId
  if (!a.canManage && !isOwner) throw new CrudError("Boleto no encontrado", 404)
  if (t.status === "cancelled") throw new CrudError("El boleto está cancelado", 409)
  const data: Record<string, unknown> = {}

  if (input.seatCode !== undefined || input.sectionId !== undefined || input.autoAssign === true) {
    if (!a.canManage && !attendeeMayChoose(e.seating, e.seatSelection)) throw new CrudError("En este evento el lugar lo asigna el personal", 403, "seatCode")
    if (e.seating === "seats" && input.seatCode === "") {
      data.seatCode = null
    } else if (e.seating === "seats") {
      const { seats, taken } = await seatContext(eventId, e)
      if (t.seatCode) taken.delete(t.seatCode)
      let target: string | null = text(input.seatCode, 20)
      if (!target && input.autoAssign === true && a.canManage) target = autoAssignSeat(seats, taken)?.code ?? null
      if (!target) throw new CrudError("Elige un asiento", 400, "seatCode")
      if (!seats.some((s) => s.code === target)) throw new CrudError("Ese asiento no existe o no se vende", 400, "seatCode")
      if (taken.has(target)) throw new CrudError("Ese lugar ya está ocupado", 409, "seatCode")
      data.seatCode = target
    } else if (e.seating === "sections") {
      const sectionId = text(input.sectionId, 40)
      await assertCapacity(e, sectionId, t.id)
      data.sectionId = sectionId
    }
  }
  if (a.canManage) {
    if (input.price !== undefined) {
      const price = money(input.price)
      if (price === null) throw new CrudError("Costo inválido", 400, "price")
      data.price = price
      data.status = ticketStatusFor(price, t.payments.map((p) => Number(p.amount)))
    }
    if (input.notes !== undefined) data.notes = text(input.notes, 300)
  }
  if (Object.keys(data).length === 0) return { ok: true }
  try {
    await prisma.eventTicket.update({ where: { id: t.id }, data })
  } catch (err) {
    if (isUnique(err)) throw new CrudError("Ese lugar acaba de ocuparse", 409, "seatCode")
    throw err
  }
  return { ok: true }
}

export async function cancelTicket(actor: Actor, eventId: string, ticketId: string) {
  const { a, t } = await loadTicket(actor, eventId, ticketId)
  const isOwner = a.memberId !== null && t.memberId === a.memberId
  if (!a.canManage && !isOwner) throw new CrudError("Boleto no encontrado", 404)
  if (t.status === "cancelled") return { ok: true }
  if (t.checkedInAt) throw new CrudError("El boleto ya tuvo entrada; no se puede cancelar", 409)
  // Se libera el lugar; los pagos quedan en el historial para su devolución o ajuste.
  await prisma.eventTicket.update({ where: { id: t.id }, data: { status: "cancelled", cancelledAt: new Date(), seatCode: null, sectionId: null } })
  // Si lo canceló la iglesia, la persona lo sabe; si lo canceló ella misma, no se le avisa de lo que hizo.
  if (t.memberId && !isOwner) {
    fireAndForget(
      notifyMembers(actor.organizationId, [t.memberId], {
        kind: "event_ticket",
        title: "Se canceló tu boleto",
        body: `Evento: ${a.event.name}`,
        link: `/mi/eventos/${eventId}`,
        severity: "warning",
        excludeUserId: actor.userId,
      })
    )
  }
  return { ok: true }
}

export async function addPayment(actor: Actor, eventId: string, ticketId: string, input: { amount?: unknown; method?: unknown; reference?: unknown; note?: unknown }) {
  const { a, t } = await loadTicket(actor, eventId, ticketId)
  assertManage(a)
  if (t.status === "cancelled") throw new CrudError("El boleto está cancelado", 409)
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const balance = ticketBalance(Number(t.price), t.payments.map((p) => Number(p.amount)))
  if (amount > balance) throw new CrudError(`El abono excede el saldo pendiente ($${balance.toFixed(2)})`, 400, "amount")
  const method = ["cash", "transfer", "card", "other"].includes(String(input.method)) ? (String(input.method) as "cash" | "transfer" | "card" | "other") : "cash"
  const all = [...t.payments.map((p) => Number(p.amount)), amount]
  await prisma.$transaction([
    prisma.eventPayment.create({
      data: { organizationId: actor.organizationId, ticketId: t.id, amount, method, reference: text(input.reference, 80), note: text(input.note, 200), receivedByUserId: actor.userId },
    }),
    prisma.eventTicket.update({ where: { id: t.id }, data: { status: ticketStatusFor(Number(t.price), all) } }),
  ])
  if (t.memberId) {
    const left = ticketBalance(Number(t.price), all)
    fireAndForget(
      notifyMembers(actor.organizationId, [t.memberId], {
        kind: "event_payment",
        title: left <= 0 ? `Boleto pagado: ${a.event.name}` : `Recibimos tu abono de ${amount.toFixed(2)}`,
        body: left <= 0 ? "Quedó liquidado. ¡Te esperamos!" : `Saldo pendiente: ${left.toFixed(2)}`,
        link: `/mi/eventos/${eventId}`,
        severity: "success",
        excludeUserId: actor.userId,
      })
    )
  }
  return { ok: true }
}

/** Entrada por QR o por boleto elegido. Requiere permiso de check-in o gestión. */
export async function checkInTicket(actor: Actor, eventId: string, input: { code?: unknown; ticketId?: unknown; allowUnpaid?: unknown }) {
  const a = await eventAccess(actor, eventId)
  if (!a.canCheckin) throw new CrudError("No tienes permiso para registrar entradas", 403)
  const code = text(input.code, 80)?.replace(/^comuapp-event:/, "") ?? null
  const ticketId = text(input.ticketId, 40)
  if (!code && !ticketId) throw new CrudError("Escanea el QR o elige el boleto", 400)
  const t = await prisma.eventTicket.findFirst({
    where: { eventId, organizationId: actor.organizationId, ...(code ? { code } : { id: ticketId! }) },
    include: { member: { select: { fullName: true } }, payments: true },
  })
  if (!t) throw new CrudError(code ? "QR no reconocido para este evento" : "Boleto no encontrado", 404)
  const name = t.member?.fullName ?? t.guestName ?? "Invitado"
  if (t.status === "cancelled") throw new CrudError(`El boleto de ${name} está cancelado`, 409)
  if (t.checkedInAt) throw new CrudError(`${name} ya registró su entrada`, 409)
  const balance = ticketBalance(Number(t.price), t.payments.map((p) => Number(p.amount)))
  if (balance > 0 && input.allowUnpaid !== true) {
    // No se bloquea la puerta por sí solo: se avisa y el personal decide.
    throw new CrudError(`${name} tiene un saldo pendiente de $${balance.toFixed(2)}`, 402, "balance")
  }
  await prisma.eventTicket.update({ where: { id: t.id }, data: { checkedInAt: new Date(), checkedInByUserId: actor.userId } })
  // La entrada solo registra la asistencia; los checks del camino se marcan al finalizar el evento.
  return { name, seatCode: t.seatCode, balance }
}

export async function listMyTickets(actor: Actor) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.eventTicket.findMany({
    where: { organizationId: actor.organizationId, memberId, status: { not: "cancelled" }, event: { status: { in: ["published", "closed"] } } },
    include: { event: { select: { id: true, name: true, startsAt: true, location: true, venue: { select: { name: true } } } }, payments: true },
    orderBy: { event: { startsAt: "asc" } },
  })
  return rows.map((t) => ({
    id: t.id,
    code: t.code,
    eventId: t.event.id,
    eventName: t.event.name,
    startsAt: t.event.startsAt.toISOString(),
    place: t.event.venue?.name ?? t.event.location,
    status: t.status,
    seatCode: t.seatCode,
    balance: ticketBalance(Number(t.price), t.payments.map((p) => Number(p.amount))),
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
  }))
}


/** Catálogo de ministerios/grupos para elegir dueño y público de un evento. */
export async function listMinistryCatalog(actor: Actor) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const leads = memberId
    ? await prisma.ministryMember.count({ where: { organizationId: actor.organizationId, memberId, isActive: true, role: "leader" } })
    : 0
  if (!actor.canManageEvents && !actor.canViewEvents && leads === 0) throw new CrudError("No tienes permiso", 403)
  const rows = await prisma.ministry.findMany({
    where: { organizationId: actor.organizationId, isActive: true },
    select: { id: true, name: true, kind: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return rows
}

/** Busca creyentes para emitirles boleto (solo quien gestiona el evento). */
/** En el evento de bautismo en aguas solo se registra a quien aún no se ha bautizado. */
async function assertNotBaptized(kind: string, memberId: string) {
  if (growthCheckForEventKind(kind) !== "baptism") return
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { baptizedWater: true, fullName: true } })
  if (m?.baptizedWater) throw new CrudError(`${m.fullName} ya se bautizó en aguas`, 409, "memberId")
}

export async function searchPeople(actor: Actor, eventId: string, q: string) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const term = q.trim()
  if (term.length < 2) return []
  const baptismOnly = growthCheckForEventKind(a.event.kind) === "baptism"
  return prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      ...(baptismOnly ? { baptizedWater: false } : {}),
      eventTickets: { none: { eventId, status: { not: "cancelled" } } },
      OR: [{ fullName: { contains: term } }, { phone: { contains: term } }],
    },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: "asc" },
    take: 15,
  })
}

// ── Gastos del evento ────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = ["hotel", "comida", "material", "transporte", "honorarios", "renta", "otro"] as const

export async function saveExpense(actor: Actor, eventId: string, id: string | null, input: Record<string, unknown>) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const concept = text(input.concept, 150)
  if (!concept) throw new CrudError("Escribe el concepto del gasto", 400, "concept")
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const spentAt = toDateTime(typeof input.spentAt === "string" ? `${input.spentAt.slice(0, 10)}T12:00:00.000Z` : "")
  if (!spentAt) throw new CrudError("Elige la fecha del gasto", 400, "spentAt")
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : "otro"
  const data = {
    concept,
    category,
    amount,
    spentAt,
    vendor: text(input.vendor, 150),
    receiptUrl: text(input.receiptUrl, 500),
    paymentMethod: ["cash", "transfer", "card", "other"].includes(String(input.paymentMethod)) ? (String(input.paymentMethod) as "cash" | "transfer" | "card" | "other") : null,
    notes: text(input.notes, 500),
  }
  if (id) {
    const r = await prisma.expense.updateMany({ where: { id, eventId, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Gasto no encontrado", 404)
    return { id }
  }
  const row = await prisma.expense.create({ data: { ...data, organizationId: actor.organizationId, eventId, createdByUserId: actor.userId } })
  return { id: row.id }
}

export async function deleteExpense(actor: Actor, eventId: string, id: string) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const r = await prisma.expense.deleteMany({ where: { id, eventId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Gasto no encontrado", 404)
  return { ok: true }
}

/**
 * Finaliza el evento (lo cierra). En el Bautismo en aguas, el Encuentro con Jesús y el
 * Lanzamiento marca el check en el crecimiento de quienes registraron su entrada y, en el
 * Lanzamiento, entrega el diploma a quien completó todos sus libros.
 */
export async function finishEvent(actor: Actor, eventId: string): Promise<{ ok: true; growth: GrowthResultDto | null }> {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  if (a.event.status === "cancelled") throw new CrudError("El evento está cancelado", 409)
  await prisma.event.update({ where: { id: eventId }, data: { status: "closed" } })
  const growth = await completeGrowthEvent(
    actor.organizationId,
    { id: a.event.id, name: a.event.name, kind: a.event.kind, startsAt: a.event.startsAt },
    actor.userId
  )
  return { ok: true, growth }
}

export interface EventGroupDto {
  name: string
  people: { name: string; checkedIn: boolean }[]
}

/** Personas con boleto agrupadas por su célula (para organizar el festejo o el traslado). */
export async function listEventGroups(actor: Actor, eventId: string): Promise<EventGroupDto[]> {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const tickets = await prisma.eventTicket.findMany({
    where: { eventId, organizationId: actor.organizationId, status: { not: "cancelled" } },
    select: {
      guestName: true,
      checkedInAt: true,
      member: { select: { fullName: true, cellMemberships: { where: { isActive: true, cell: { isActive: true } }, select: { cell: { select: { name: true } } }, take: 1 } } },
    },
  })
  const groups = new Map<string, EventGroupDto>()
  for (const t of tickets) {
    const key = t.member?.cellMemberships[0]?.cell.name ?? "Sin célula"
    const g = groups.get(key) ?? { name: key, people: [] }
    g.people.push({ name: t.member?.fullName ?? t.guestName ?? "Invitado", checkedIn: Boolean(t.checkedInAt) })
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, people: g.people.sort((x, y) => x.name.localeCompare(y.name, "es")) }))
    .sort((x, y) => (x.name === "Sin célula" ? 1 : y.name === "Sin célula" ? -1 : x.name.localeCompare(y.name, "es")))
}
