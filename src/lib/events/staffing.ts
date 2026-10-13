import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import { fireAndForget, notifyMembers, notifyMinistryLeaders } from "@/lib/notifications/church"
import { assertManage, eventAccess } from "@/lib/events/server"
import { eventClosedForStaffing, isStaffAction, remainingSlots, staffCounts, type StaffStatus } from "./staffing-rules"

// Servidores para eventos. El organizador pide N servidores a un ministerio; su líder
// asigna a quién (cada asignado confirma o dice que no puede) y los servidores también
// pueden ofrecerse a un pedido abierto (el líder los acepta).
//
//  - Pedir, cambiar o quitar un pedido: quien gestiona el evento.
//  - Asignar, aceptar ofrecimientos y quitar: líder del ministerio (o el organizador).
//  - Ofrecerse, confirmar, decir que no puede o retirarse: el propio servidor.

const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)

export interface StaffAssignmentDto {
  id: string
  memberId: string
  fullName: string
  status: StaffStatus
}

export interface StaffRequestDto {
  id: string
  eventId: string
  eventName: string
  eventStartsAt: string
  eventLocation: string | null
  ministryId: string
  ministryName: string
  quantity: number
  notes: string | null
  confirmed: number
  assigned: number
  offered: number
  remaining: number
  /** El evento ya pasó o se canceló: solo lectura. */
  closed: boolean
  assignments: StaffAssignmentDto[]
  /** Estado de la persona que consulta, si participa. */
  mine: StaffStatus | null
  /** Puede asignar y decidir ofrecimientos (líder del ministerio u organizador). */
  canAssign: boolean
  /** Puede ofrecerse (sirve en el ministerio y aún no participa). */
  canOffer: boolean
}

const requestInclude = {
  event: { select: { id: true, name: true, startsAt: true, location: true, status: true } },
  ministry: { select: { id: true, name: true } },
  assignments: { include: { member: { select: { fullName: true } } }, orderBy: { createdAt: "asc" as const } },
} as const
type RequestRow = Awaited<ReturnType<typeof prisma.eventStaffRequest.findFirstOrThrow<{ include: typeof requestInclude }>>>

function toDto(r: RequestRow, view: { mineId: string | null; canAssign: boolean; isRoster: boolean }): StaffRequestDto {
  const statuses = r.assignments.map((a) => a.status)
  const c = staffCounts(statuses)
  const mine = (view.mineId ? (r.assignments.find((a) => a.memberId === view.mineId)?.status as StaffStatus | undefined) : undefined) ?? null
  const closed = eventClosedForStaffing(r.event.startsAt, r.event.status)
  return {
    id: r.id,
    eventId: r.eventId,
    eventName: r.event.name,
    eventStartsAt: r.event.startsAt.toISOString(),
    eventLocation: r.event.location,
    ministryId: r.ministryId,
    ministryName: r.ministry.name,
    quantity: r.quantity,
    notes: r.notes,
    confirmed: c.confirmed,
    assigned: c.assigned,
    offered: c.offered,
    remaining: remainingSlots(r.quantity, statuses),
    closed,
    assignments: r.assignments.map((a) => ({ id: a.id, memberId: a.memberId, fullName: a.member.fullName, status: a.status as StaffStatus })),
    mine,
    canAssign: view.canAssign && !closed,
    canOffer: view.isRoster && !closed && (mine === null || mine === "declined" || mine === "rejected") && remainingSlots(r.quantity, statuses) > 0,
  }
}

// ── Organizador ──────────────────────────────────────────────────────────────

export async function listEventStaff(actor: Actor, eventId: string): Promise<StaffRequestDto[]> {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const rows = await prisma.eventStaffRequest.findMany({
    where: { eventId, organizationId: actor.organizationId },
    include: requestInclude,
    orderBy: { createdAt: "asc" },
  })
  return rows.map((r) => toDto(r, { mineId: a.memberId, canAssign: true, isRoster: false }))
}

export async function saveStaffRequest(actor: Actor, eventId: string, input: { ministryId?: unknown; quantity?: unknown; notes?: unknown }) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  if (eventClosedForStaffing(a.event.startsAt, a.event.status)) throw new CrudError("El evento ya pasó o está cancelado", 409)
  const ministryId = typeof input.ministryId === "string" ? input.ministryId : ""
  const ministry = await prisma.ministry.findFirst({ where: { id: ministryId, organizationId: actor.organizationId, isActive: true }, select: { id: true, name: true } })
  if (!ministry) throw new CrudError("Elige el ministerio", 400, "ministryId")
  const quantity = Number(input.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new CrudError("Indica cuántos servidores necesitas (1 a 500)", 400, "quantity")
  const notes = text(input.notes, 300)
  const existing = await prisma.eventStaffRequest.findUnique({ where: { eventId_ministryId: { eventId, ministryId } }, include: { assignments: { select: { status: true } } } })
  if (existing) {
    const taken = staffCounts(existing.assignments.map((x) => x.status)).taken
    if (quantity < taken) throw new CrudError(`Ya hay ${taken} asignados; quita a alguien antes de pedir menos`, 409, "quantity")
  }
  const row = await prisma.eventStaffRequest.upsert({
    where: { eventId_ministryId: { eventId, ministryId } },
    update: { quantity, notes },
    create: { organizationId: actor.organizationId, eventId, ministryId, quantity, notes, createdByUserId: actor.userId },
    select: { id: true },
  })
  if (!existing) {
    fireAndForget(
      notifyMinistryLeaders(actor.organizationId, ministryId, {
        kind: "event_staff_request",
        title: `Piden ${quantity} servidor${quantity === 1 ? "" : "es"} para «${a.event.name}»`,
        body: notes ?? `Asigna a quienes servirán desde tu ministerio.`,
        link: `/mi/ministerios/${ministryId}`,
        excludeUserId: actor.userId,
      })
    )
  }
  return { id: row.id }
}

export async function deleteStaffRequest(actor: Actor, eventId: string, requestId: string) {
  const a = await eventAccess(actor, eventId)
  assertManage(a)
  const req = await prisma.eventStaffRequest.findFirst({ where: { id: requestId, eventId, organizationId: actor.organizationId }, include: { assignments: { select: { memberId: true } } } })
  if (!req) throw new CrudError("Pedido no encontrado", 404)
  await prisma.eventStaffRequest.delete({ where: { id: requestId } })
  fireAndForget(
    notifyMembers(actor.organizationId, req.assignments.map((x) => x.memberId), {
      kind: "event_staff_cancelled",
      title: "Se canceló el pedido de servidores",
      body: `Ya no se necesitan servidores de tu ministerio para «${a.event.name}».`,
      link: "/mi/ministerios",
    })
  )
  return { ok: true }
}

// ── Ministerio ───────────────────────────────────────────────────────────────

export interface MinistryStaffDto {
  /** Puede asignar (líder/apoyo con gestión). */
  canAssign: boolean
  requests: StaffRequestDto[]
  /** Integrantes activos, para asignar, con aviso si ya sirven ese día en otro evento. */
  roster: { memberId: string; fullName: string; role: string; busyWith: Record<string, string> }[]
}

export async function listMinistryStaffRequests(actor: Actor, ministryId: string): Promise<MinistryStaffDto> {
  const access = await ministryAccess(actor, ministryId)
  if (!access.canView) throw new CrudError("Ministerio no encontrado", 404)
  const from = new Date(Date.now() - 86_400_000)
  const rows = await prisma.eventStaffRequest.findMany({
    where: { ministryId, organizationId: actor.organizationId, event: { startsAt: { gte: from }, status: { not: "cancelled" } } },
    include: requestInclude,
    orderBy: { event: { startsAt: "asc" } },
  })
  const isRoster = access.myRole !== null
  const canAssign = access.canManage
  let roster: MinistryStaffDto["roster"] = []
  if (canAssign && rows.length > 0) {
    const people = await prisma.ministryMember.findMany({
      where: { ministryId, organizationId: actor.organizationId, isActive: true, member: { isActive: true } },
      select: { memberId: true, role: true, member: { select: { fullName: true } } },
    })
    // Otros eventos el mismo día en que ya servirán.
    const days = new Set(rows.map((r) => ymd(r.event.startsAt)))
    const others = await prisma.eventStaffAssignment.findMany({
      where: {
        organizationId: actor.organizationId,
        memberId: { in: people.map((p) => p.memberId) },
        status: { in: ["assigned", "confirmed"] },
        request: { ministryId: { not: ministryId }, event: { startsAt: { gte: new Date(from.getTime() - 86_400_000) } } },
      },
      select: { memberId: true, request: { select: { event: { select: { name: true, startsAt: true } } } } },
    })
    roster = people
      .map((p) => {
        const busyWith: Record<string, string> = {}
        for (const o of others) {
          const d = ymd(o.request.event.startsAt)
          if (o.memberId === p.memberId && days.has(d)) busyWith[d] = o.request.event.name
        }
        return { memberId: p.memberId, fullName: p.member.fullName, role: p.role, busyWith }
      })
      .sort((x, y) => x.fullName.localeCompare(y.fullName, "es"))
  }
  return {
    canAssign,
    requests: rows.map((r) => toDto(r, { mineId: access.memberId, canAssign, isRoster })),
    roster,
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

export async function staffAction(actor: Actor, requestId: string, input: Record<string, unknown>) {
  const action = input.action
  if (!isStaffAction(action)) throw new CrudError("Acción no válida", 400, "action")
  const req = await prisma.eventStaffRequest.findFirst({ where: { id: requestId, organizationId: actor.organizationId }, include: requestInclude })
  if (!req) throw new CrudError("Pedido no encontrado", 404)
  const [access, ea] = await Promise.all([ministryAccess(actor, req.ministryId).catch(() => null), eventAccess(actor, req.eventId).catch(() => null)])
  const myId = access?.memberId ?? (await memberIdOfUser(actor.organizationId, actor.userId))
  const canAssign = Boolean(access?.canManage || ea?.canManage)
  const isRoster = Boolean(access && access.myRole !== null)
  if (!access && !ea) throw new CrudError("Pedido no encontrado", 404)
  if (eventClosedForStaffing(req.event.startsAt, req.event.status)) throw new CrudError("El evento ya pasó o está cancelado", 409)

  const statuses = req.assignments.map((a) => a.status)
  const own = myId ? req.assignments.find((a) => a.memberId === myId) : undefined
  const eventName = req.event.name
  const when = req.event.startsAt.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
  const leadersNotice = (title: string, body: string) =>
    fireAndForget(notifyMinistryLeaders(actor.organizationId, req.ministryId, { kind: "event_staff", title, body, link: `/mi/ministerios/${req.ministryId}`, excludeUserId: actor.userId }))

  const setStatus = (id: string, status: StaffStatus) =>
    prisma.eventStaffAssignment.update({ where: { id }, data: { status, decidedByUserId: actor.userId } })

  switch (action) {
    case "assign": {
      if (!canAssign) throw new CrudError("Solo el líder del ministerio asigna a su equipo", 403)
      const ids = Array.isArray(input.memberIds) ? [...new Set(input.memberIds.filter((x): x is string => typeof x === "string"))].slice(0, 100) : []
      if (ids.length === 0) throw new CrudError("Elige a quién asignar", 400, "memberIds")
      const roster = await prisma.ministryMember.findMany({
        where: { ministryId: req.ministryId, organizationId: actor.organizationId, isActive: true, memberId: { in: ids } },
        select: { memberId: true },
      })
      if (roster.length !== ids.length) throw new CrudError("Hay personas que no sirven en este ministerio", 400, "memberIds")
      const toAdd = ids.filter((id) => !req.assignments.some((a) => a.memberId === id && (a.status === "assigned" || a.status === "confirmed")))
      if (toAdd.length > remainingSlots(req.quantity, statuses)) {
        throw new CrudError(`Solo quedan ${remainingSlots(req.quantity, statuses)} lugar(es) de ${req.quantity}`, 409, "memberIds")
      }
      for (const memberId of toAdd) {
        await prisma.eventStaffAssignment.upsert({
          where: { requestId_memberId: { requestId, memberId } },
          update: { status: "assigned", decidedByUserId: actor.userId },
          create: { organizationId: actor.organizationId, requestId, memberId, status: "assigned", decidedByUserId: actor.userId },
        })
      }
      fireAndForget(
        notifyMembers(actor.organizationId, toAdd, {
          kind: "event_staff_assigned",
          title: `Te asignaron a servir en «${eventName}»`,
          body: `${when}${req.event.location ? ` · ${req.event.location}` : ""}. Confirma si puedes.`,
          link: `/mi/ministerios/${req.ministryId}`,
          excludeUserId: actor.userId,
        })
      )
      return { ok: true, added: toAdd.length }
    }
    case "remove": {
      const a = req.assignments.find((x) => x.id === input.assignmentId)
      if (!a) throw new CrudError("Asignación no encontrada", 404)
      if (!canAssign) throw new CrudError("Solo el líder del ministerio quita asignaciones", 403)
      await prisma.eventStaffAssignment.delete({ where: { id: a.id } })
      fireAndForget(notifyMembers(actor.organizationId, [a.memberId], { kind: "event_staff", title: `Ya no servirás en «${eventName}»`, body: "El líder de tu ministerio hizo un cambio.", link: `/mi/ministerios/${req.ministryId}`, excludeUserId: actor.userId }))
      return { ok: true }
    }
    case "approve":
    case "reject": {
      if (!canAssign) throw new CrudError("Solo el líder del ministerio decide los ofrecimientos", 403)
      const a = req.assignments.find((x) => x.id === input.assignmentId)
      if (!a || a.status !== "offered") throw new CrudError("No hay un ofrecimiento por decidir", 404)
      if (a.memberId === myId) throw new CrudError("No puedes decidir tu propio ofrecimiento", 403)
      if (action === "approve" && remainingSlots(req.quantity, statuses) <= 0) throw new CrudError("El pedido ya está completo", 409)
      await setStatus(a.id, action === "approve" ? "confirmed" : "rejected")
      fireAndForget(
        notifyMembers(actor.organizationId, [a.memberId], {
          kind: "event_staff",
          severity: action === "approve" ? "success" : "info",
          title: action === "approve" ? `¡Servirás en «${eventName}»!` : `No será posible servir en «${eventName}»`,
          body: action === "approve" ? `${when}.` : "Gracias por ofrecerte; el equipo ya está completo.",
          link: `/mi/ministerios/${req.ministryId}`,
          excludeUserId: actor.userId,
        })
      )
      return { ok: true }
    }
    case "offer": {
      if (!isRoster || !myId) throw new CrudError("Solo quienes sirven en este ministerio pueden ofrecerse", 403)
      if (own && (own.status === "assigned" || own.status === "confirmed" || own.status === "offered")) throw new CrudError("Ya participas o esperas respuesta en este pedido", 409)
      if (remainingSlots(req.quantity, statuses) <= 0) throw new CrudError("El pedido ya está completo", 409)
      await prisma.eventStaffAssignment.upsert({
        where: { requestId_memberId: { requestId, memberId: myId } },
        update: { status: "offered" },
        create: { organizationId: actor.organizationId, requestId, memberId: myId, status: "offered" },
      })
      const who = await prisma.member.findUnique({ where: { id: myId }, select: { fullName: true } })
      leadersNotice("Un servidor se ofreció", `${who?.fullName ?? "Alguien"} quiere servir en «${eventName}».`)
      return { ok: true }
    }
    case "confirm":
    case "decline": {
      if (!own || own.status !== "assigned") throw new CrudError("No tienes una asignación por responder", 409)
      await setStatus(own.id, action === "confirm" ? "confirmed" : "declined")
      const who = await prisma.member.findUnique({ where: { id: own.memberId }, select: { fullName: true } })
      leadersNotice(
        action === "confirm" ? "Confirmó su servicio" : "No podrá servir: reasigna",
        `${who?.fullName ?? "Un servidor"} ${action === "confirm" ? "confirmó" : "no puede"} para «${eventName}».`
      )
      return { ok: true }
    }
    case "withdraw": {
      if (!own || !["offered", "confirmed", "assigned"].includes(own.status)) throw new CrudError("No participas en este pedido", 409)
      const wasConfirmed = own.status !== "offered"
      await prisma.eventStaffAssignment.delete({ where: { id: own.id } })
      if (wasConfirmed) {
        const who = await prisma.member.findUnique({ where: { id: own.memberId }, select: { fullName: true } })
        leadersNotice("Se retiró un servidor", `${who?.fullName ?? "Un servidor"} ya no podrá servir en «${eventName}»; falta cubrir su lugar.`)
      }
      return { ok: true }
    }
  }
}

// ── Personal ─────────────────────────────────────────────────────────────────

export interface MyStaffDto {
  requestId: string
  eventId: string
  eventName: string
  startsAt: string
  location: string | null
  ministryId: string
  ministryName: string
  status: StaffStatus
}

/** Eventos próximos en que la persona servirá o espera su confirmación. */
export async function myStaffAssignments(actor: Actor): Promise<MyStaffDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.eventStaffAssignment.findMany({
    where: {
      organizationId: actor.organizationId,
      memberId,
      status: { in: ["assigned", "confirmed", "offered"] },
      request: { event: { startsAt: { gte: new Date(Date.now() - 3 * 3600_000) }, status: { not: "cancelled" } } },
    },
    include: { request: { include: { event: { select: { id: true, name: true, startsAt: true, location: true } }, ministry: { select: { id: true, name: true } } } } },
    orderBy: { request: { event: { startsAt: "asc" } } },
    take: 20,
  })
  return rows.map((a) => ({
    requestId: a.requestId,
    eventId: a.request.event.id,
    eventName: a.request.event.name,
    startsAt: a.request.event.startsAt.toISOString(),
    location: a.request.event.location,
    ministryId: a.request.ministry.id,
    ministryName: a.request.ministry.name,
    status: a.status as StaffStatus,
  }))
}
