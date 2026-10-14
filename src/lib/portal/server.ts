import { Prisma } from "@/generated/prisma/client"
import { normalizeFlyer, type Flyer } from "@/lib/portal/flyer"
import { prisma } from "@/lib/db"
import { myStaffAssignments } from "@/lib/events/staffing"
import { fireAndForget, notifyChurch, notifyMembers, notifyMinistryLeaders } from "@/lib/notifications/church"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import {
  isPostAudience,
  isPostKind,
  isStreamStatus,
  parseStreamUrl,
  weeklySlotLabel,
  type PostAudience,
  type PostKind,
  type StreamPlatform,
  type StreamStatus,
} from "@/lib/portal/rules"

// Portal del creyente: publicaciones, transmisiones, perfil propio y solicitudes
// para servir en un ministerio. Todo se resuelve por la sesión: el creyente solo ve
// y edita lo suyo; publicar contenido requiere `content.manage`.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const iso = (d: Date | null) => (d ? d.toISOString() : null)
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

function assertContentManager(actor: Actor) {
  if (!actor.canManageContent && !actor.canManageAll) throw new CrudError("No tienes permiso para administrar el contenido", 403)
}

/** «Líder» para el contenido dirigido: jerarquía por encima de creyente o líder/asistente de ministerio. */
async function isLeaderish(actor: Actor): Promise<boolean> {
  if (actor.canManageContent || actor.canManageAll) return true
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return false
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { hierarchy: true } })
  if (m && m.hierarchy !== "believer") return true
  const led = await prisma.ministryMember.count({ where: { memberId, isActive: true, role: { in: ["leader", "assistant"] } } })
  return led > 0
}

// ── Publicaciones ────────────────────────────────────────────────────────────

export interface PostDto {
  id: string
  title: string
  body: string
  kind: PostKind
  coverUrl: string | null
  flyer: Flyer | null
  audience: PostAudience
  pinned: boolean
  isPublished: boolean
  publishedAt: string
}

const postDto = (p: {
  id: string
  title: string
  body: string
  kind: string
  coverUrl: string | null
  flyer?: unknown
  audience: string
  pinned: boolean
  isPublished: boolean
  publishedAt: Date
}): PostDto => ({
  id: p.id,
  title: p.title,
  body: p.body,
  kind: isPostKind(p.kind) ? p.kind : "announcement",
  coverUrl: p.coverUrl,
  flyer: normalizeFlyer(p.flyer, isPostKind(p.kind) ? p.kind : "announcement"),
  audience: isPostAudience(p.audience) ? p.audience : "all",
  pinned: p.pinned,
  isPublished: p.isPublished,
  publishedAt: p.publishedAt.toISOString(),
})

export async function listPosts(actor: Actor, opts: { manage?: boolean; limit?: number } = {}): Promise<PostDto[]> {
  if (opts.manage) {
    assertContentManager(actor)
    const rows = await prisma.post.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 200,
    })
    return rows.map(postDto)
  }
  const leaders = await isLeaderish(actor)
  const rows = await prisma.post.findMany({
    where: {
      organizationId: actor.organizationId,
      isPublished: true,
      publishedAt: { lte: new Date() },
      audience: leaders ? { in: ["all", "leaders"] } : "all",
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: Math.min(opts.limit ?? 50, 100),
  })
  return rows.map(postDto)
}

function postInput(input: Record<string, unknown>, partial: boolean) {
  const data: {
    title?: string
    body?: string
    kind?: PostKind
    coverUrl?: string | null
    flyer?: Flyer | null
    audience?: PostAudience
    pinned?: boolean
    isPublished?: boolean
    publishedAt?: Date
  } = {}
  if (!partial || input.title !== undefined) {
    const title = text(input.title, 160)
    if (!title) throw new CrudError("Escribe el título", 400, "title")
    data.title = title
  }
  if (!partial || input.body !== undefined) {
    const body = text(input.body, 8000)
    if (!body) throw new CrudError("Escribe el contenido", 400, "body")
    data.body = body
  }
  if (input.kind !== undefined) {
    if (!isPostKind(input.kind)) throw new CrudError("Tipo de publicación inválido", 400, "kind")
    data.kind = input.kind
  }
  if (input.audience !== undefined) {
    if (!isPostAudience(input.audience)) throw new CrudError("Público inválido", 400, "audience")
    data.audience = input.audience
  }
  if (input.coverUrl !== undefined) {
    const url = text(input.coverUrl, 500)
    if (url && !/^(https:\/\/|\/)/.test(url)) throw new CrudError("La imagen debe ser una dirección válida", 400, "coverUrl")
    data.coverUrl = url
  }
  if (input.flyer !== undefined) {
    // null o inválido quita el flyer; lo demás se normaliza (colores, tipografía, enlaces).
    data.flyer = normalizeFlyer(input.flyer, isPostKind(input.kind) ? input.kind : "announcement")
  }
  if (input.pinned !== undefined) data.pinned = input.pinned === true
  if (input.isPublished !== undefined) data.isPublished = input.isPublished !== false
  if (input.publishedAt !== undefined && input.publishedAt !== null && input.publishedAt !== "") {
    const d = new Date(String(input.publishedAt))
    if (Number.isNaN(d.getTime())) throw new CrudError("Fecha de publicación inválida", 400, "publishedAt")
    data.publishedAt = d
  }
  return data
}

export async function createPost(actor: Actor, input: Record<string, unknown>) {
  assertContentManager(actor)
  const data = postInput(input, false)
  const row = await prisma.post.create({
    data: {
      organizationId: actor.organizationId,
      authorId: actor.userId,
      title: data.title!,
      body: data.body!,
      kind: data.kind ?? "announcement",
      coverUrl: data.coverUrl ?? null,
      ...(data.flyer ? { flyer: data.flyer as unknown as Prisma.InputJsonValue } : {}),
      audience: data.audience ?? "all",
      pinned: data.pinned ?? false,
      isPublished: data.isPublished ?? true,
      ...(data.publishedAt ? { publishedAt: data.publishedAt } : {}),
    },
  })
  if (row.isPublished && row.publishedAt <= new Date()) announcePost(actor, row)
  return { id: row.id }
}

async function ownPost(actor: Actor, postId: string) {
  const row = await prisma.post.findFirst({ where: { id: postId, organizationId: actor.organizationId } })
  if (!row) throw new CrudError("Publicación no encontrada", 404)
  return row
}

export async function updatePost(actor: Actor, postId: string, input: Record<string, unknown>) {
  assertContentManager(actor)
  const before = await ownPost(actor, postId)
  const { flyer, ...rest } = postInput(input, true)
  const row = await prisma.post.update({
    where: { id: postId },
    data: { ...rest, ...(flyer === undefined ? {} : { flyer: flyer === null ? Prisma.DbNull : (flyer as unknown as Prisma.InputJsonValue) }) },
  })
  // Solo se avisa cuando pasa de borrador a publicada, no en cada edición.
  if (!before.isPublished && row.isPublished && row.publishedAt <= new Date()) announcePost(actor, row)
  return { ok: true }
}

const POST_LABEL: Record<string, string> = { announcement: "Anuncio", devotional: "Devocional", article: "Artículo", news: "Noticia" }

function announcePost(actor: Actor, p: { id: string; title: string; kind: string; audience: string }) {
  fireAndForget(
    notifyChurch(
      actor.organizationId,
      { kind: "post", title: `${POST_LABEL[p.kind] ?? "Novedad"}: ${p.title}`.slice(0, 120), body: "Ya está en tus noticias.", link: `/mi/contenido#${p.id}`, excludeUserId: actor.userId },
      { leadersOnly: p.audience === "leaders" }
    )
  )
}

function announceLive(actor: Actor, s: { title: string }) {
  fireAndForget(
    notifyChurch(actor.organizationId, {
      kind: "stream_live",
      severity: "success",
      title: "¡Estamos en vivo!",
      body: s.title,
      link: "/mi/transmisiones",
      excludeUserId: actor.userId,
    })
  )
}

export async function deletePost(actor: Actor, postId: string) {
  assertContentManager(actor)
  await ownPost(actor, postId)
  await prisma.post.delete({ where: { id: postId } })
  return { ok: true }
}

// ── Transmisiones ────────────────────────────────────────────────────────────

export interface StreamDto {
  id: string
  title: string
  description: string | null
  platform: StreamPlatform
  url: string
  embedUrl: string | null
  scheduledAt: string | null
  status: StreamStatus
  isPublished: boolean
}

const streamDto = (s: {
  id: string
  title: string
  description: string | null
  platform: string
  url: string
  scheduledAt: Date | null
  status: string
  isPublished: boolean
}): StreamDto => {
  const parsed = parseStreamUrl(s.url)
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    platform: parsed?.platform ?? (s.platform === "facebook" ? "facebook" : "youtube"),
    url: s.url,
    embedUrl: parsed?.embedUrl ?? null,
    scheduledAt: iso(s.scheduledAt),
    status: isStreamStatus(s.status) ? s.status : "scheduled",
    isPublished: s.isPublished,
  }
}

export async function listStreams(actor: Actor, opts: { manage?: boolean } = {}): Promise<StreamDto[]> {
  if (opts.manage) assertContentManager(actor)
  const rows = await prisma.stream.findMany({
    where: { organizationId: actor.organizationId, ...(opts.manage ? {} : { isPublished: true }) },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  })
  const order: Record<string, number> = { live: 0, scheduled: 1, ended: 2 }
  return rows.map(streamDto).sort((a, b) => order[a.status] - order[b.status])
}

function streamInput(input: Record<string, unknown>, partial: boolean) {
  const data: {
    title?: string
    description?: string | null
    platform?: StreamPlatform
    url?: string
    scheduledAt?: Date | null
    status?: StreamStatus
    isPublished?: boolean
  } = {}
  if (!partial || input.title !== undefined) {
    const title = text(input.title, 160)
    if (!title) throw new CrudError("Escribe el título", 400, "title")
    data.title = title
  }
  if (input.description !== undefined) data.description = text(input.description, 2000)
  if (!partial || input.url !== undefined) {
    const parsed = parseStreamUrl(String(input.url ?? ""))
    if (!parsed) throw new CrudError("Pega un enlace https de un video o directo de YouTube o Facebook", 400, "url")
    data.url = parsed.url
    data.platform = parsed.platform
  }
  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt === null || input.scheduledAt === "") data.scheduledAt = null
    else {
      const d = new Date(String(input.scheduledAt))
      if (Number.isNaN(d.getTime())) throw new CrudError("Fecha inválida", 400, "scheduledAt")
      data.scheduledAt = d
    }
  }
  if (input.status !== undefined) {
    if (!isStreamStatus(input.status)) throw new CrudError("Estado inválido", 400, "status")
    data.status = input.status
  }
  if (input.isPublished !== undefined) data.isPublished = input.isPublished !== false
  return data
}

export async function createStream(actor: Actor, input: Record<string, unknown>) {
  assertContentManager(actor)
  const data = streamInput(input, false)
  const row = await prisma.stream.create({
    data: {
      organizationId: actor.organizationId,
      title: data.title!,
      description: data.description ?? null,
      platform: data.platform!,
      url: data.url!,
      scheduledAt: data.scheduledAt ?? null,
      status: data.status ?? "scheduled",
      isPublished: data.isPublished ?? true,
    },
  })
  if (row.status === "live" && row.isPublished) announceLive(actor, row)
  return { id: row.id }
}

export async function updateStream(actor: Actor, streamId: string, input: Record<string, unknown>) {
  assertContentManager(actor)
  const row = await prisma.stream.findFirst({ where: { id: streamId, organizationId: actor.organizationId } })
  if (!row) throw new CrudError("Transmisión no encontrada", 404)
  const next = await prisma.stream.update({ where: { id: streamId }, data: streamInput(input, true) })
  // Avisa cuando la transmisión pasa a «en vivo» (una sola vez por salto).
  if (row.status !== "live" && next.status === "live" && next.isPublished) announceLive(actor, next)
  return { ok: true }
}

export async function deleteStream(actor: Actor, streamId: string) {
  assertContentManager(actor)
  const row = await prisma.stream.findFirst({ where: { id: streamId, organizationId: actor.organizationId }, select: { id: true } })
  if (!row) throw new CrudError("Transmisión no encontrada", 404)
  await prisma.stream.delete({ where: { id: streamId } })
  return { ok: true }
}

// ── Inicio del portal ────────────────────────────────────────────────────────

export interface AgendaItem {
  kind: "event" | "cell" | "serve"
  id: string
  title: string
  /** Fecha y hora (eventos) o null si es semanal. */
  at: string | null
  detail: string | null
  href: string
}

export interface PortalHomeDto {
  live: StreamDto | null
  nextStream: StreamDto | null
  posts: PostDto[]
  agenda: AgendaItem[]
  canManageContent: boolean
  /** Solicitudes de ministerio por decidir (para líderes). */
  pendingJoinRequests: number
}

export async function getPortalHome(actor: Actor): Promise<PortalHomeDto> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const now = new Date()
  const [streams, posts, tickets, cells, pending, serving] = await Promise.all([
    listStreams(actor),
    listPosts(actor, { limit: 3 }),
    memberId
      ? prisma.eventTicket.findMany({
          where: {
            organizationId: actor.organizationId,
            memberId,
            status: { not: "cancelled" },
            event: { startsAt: { gte: new Date(now.getTime() - 3 * 3600_000) }, status: { not: "cancelled" } },
          },
          select: { eventId: true, seatCode: true, event: { select: { name: true, startsAt: true, location: true } } },
          orderBy: { event: { startsAt: "asc" } },
          take: 5,
        })
      : [],
    memberId
      ? prisma.cellMember.findMany({
          where: { memberId, isActive: true, organizationId: actor.organizationId, cell: { isActive: true } },
          select: { cell: { select: { id: true, name: true, dayOfWeek: true, startTime: true } } },
          take: 3,
        })
      : [],
    countPendingJoinRequests(actor),
    myStaffAssignments(actor).catch(() => []),
  ])

  const agenda: AgendaItem[] = [
    ...tickets.map(
      (t): AgendaItem => ({
        kind: "event",
        id: t.eventId,
        title: t.event.name,
        at: t.event.startsAt.toISOString(),
        detail: [t.event.location, t.seatCode ? `lugar ${t.seatCode}` : null].filter(Boolean).join(" · ") || null,
        href: `/mi/eventos/${t.eventId}`,
      })
    ),
    ...serving.map(
      (s): AgendaItem => ({
        kind: "serve",
        id: s.requestId,
        title: `Servirás en «${s.eventName}»`,
        at: s.startsAt,
        detail: [s.ministryName, s.status === "assigned" ? "por confirmar" : s.status === "offered" ? "esperando respuesta" : null].filter(Boolean).join(" · "),
        href: `/mi/ministerios/${s.ministryId}`,
      })
    ),
    ...cells.map(
      (c): AgendaItem => ({
        kind: "cell",
        id: c.cell.id,
        title: c.cell.name,
        at: null,
        detail: weeklySlotLabel(c.cell.dayOfWeek, c.cell.startTime),
        href: `/mi/celulas/${c.cell.id}`,
      })
    ),
  ]
  return {
    live: streams.find((s) => s.status === "live") ?? null,
    nextStream: streams.find((s) => s.status === "scheduled" && s.scheduledAt && new Date(s.scheduledAt) >= now) ?? null,
    posts,
    agenda,
    canManageContent: Boolean(actor.canManageContent || actor.canManageAll),
    pendingJoinRequests: pending,
  }
}

// ── Perfil propio ────────────────────────────────────────────────────────────

export interface ProfileDto {
  memberId: string
  fullName: string
  phone: string | null
  email: string | null
  gender: "male" | "female" | null
  birthDate: string | null
  maritalStatus: string | null
  occupation: string | null
  street: string | null
  streetNumber: string | null
  neighborhood: string | null
  city: string | null
  postalCode: string | null
  contactSchedule: string | null
  imageUrl: string | null
  memberCode: string | null
}

const MARITAL = ["single", "married", "free_union", "separated", "divorced", "widowed"]

export async function getMyProfile(actor: Actor): Promise<ProfileDto | null> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return null
  const m = await prisma.member.findUniqueOrThrow({ where: { id: memberId } })
  return {
    memberId: m.id,
    fullName: m.fullName,
    phone: m.phone,
    email: m.email,
    gender: m.gender,
    birthDate: ymd(m.birthDate),
    maritalStatus: m.maritalStatus,
    occupation: m.occupation,
    street: m.street,
    streetNumber: m.streetNumber,
    neighborhood: m.neighborhood,
    city: m.city,
    postalCode: m.postalCode,
    contactSchedule: m.contactSchedule,
    imageUrl: m.imageUrl,
    memberCode: m.memberCode,
  }
}

/**
 * El creyente edita SOLO sus datos personales. Nombre, jerarquía, etapa, bautismos y
 * quien lo discipula los administra la iglesia: aquí no se aceptan.
 */
export async function saveMyProfile(actor: Actor, input: Record<string, unknown>) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu cuenta aún no está ligada a un registro de la iglesia", 409)
  const data: Record<string, unknown> = {}

  if (input.phone !== undefined) {
    const phone = text(input.phone, 30)
    if (phone && !/^[0-9+()\-.\s]{7,30}$/.test(phone)) throw new CrudError("Escribe un teléfono válido", 400, "phone")
    data.phone = phone
  }
  if (input.email !== undefined) {
    const email = text(input.email, 120)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CrudError("Escribe un correo válido", 400, "email")
    data.email = email ? email.toLowerCase() : null
  }
  if (input.gender !== undefined) {
    if (input.gender !== null && input.gender !== "" && input.gender !== "male" && input.gender !== "female") throw new CrudError("Género inválido", 400, "gender")
    data.gender = input.gender === "male" || input.gender === "female" ? input.gender : null
  }
  if (input.maritalStatus !== undefined) {
    if (input.maritalStatus && !MARITAL.includes(String(input.maritalStatus))) throw new CrudError("Estado civil inválido", 400, "maritalStatus")
    data.maritalStatus = input.maritalStatus ? String(input.maritalStatus) : null
  }
  if (input.birthDate !== undefined) {
    if (!input.birthDate) data.birthDate = null
    else {
      const raw = String(input.birthDate).slice(0, 10)
      const d = new Date(`${raw}T00:00:00.000Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(d.getTime()) || d > new Date()) throw new CrudError("Fecha de nacimiento inválida", 400, "birthDate")
      data.birthDate = d
    }
  }
  const strings: [string, number][] = [
    ["occupation", 100],
    ["street", 150],
    ["streetNumber", 20],
    ["neighborhood", 100],
    ["city", 100],
    ["postalCode", 10],
    ["contactSchedule", 150],
  ]
  for (const [key, max] of strings) if (input[key] !== undefined) data[key] = text(input[key], max)
  if (input.imageUrl !== undefined) {
    const url = text(input.imageUrl, 500)
    if (url && !/^(https:\/\/|\/)/.test(url)) throw new CrudError("La foto debe ser una dirección válida", 400, "imageUrl")
    data.imageUrl = url
  }
  if (Object.keys(data).length === 0) throw new CrudError("No hay cambios que guardar", 400)
  await prisma.member.update({ where: { id: memberId }, data })
  return { ok: true }
}

// ── Servir en un ministerio ──────────────────────────────────────────────────

export interface JoinCatalogItem {
  id: string
  name: string
  description: string | null
  requirements: string | null
  state: "none" | "pending" | "member" | "rejected"
}

export async function listJoinCatalog(actor: Actor): Promise<JoinCatalogItem[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const ministries = await prisma.ministry.findMany({
    where: { organizationId: actor.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, requirements: true },
  })
  if (!memberId) return ministries.map((m) => ({ ...m, state: "none" as const }))
  const [memberships, requests] = await Promise.all([
    prisma.ministryMember.findMany({ where: { memberId, isActive: true }, select: { ministryId: true } }),
    prisma.ministryJoinRequest.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, select: { ministryId: true, status: true } }),
  ])
  const inMinistry = new Set(memberships.map((m) => m.ministryId))
  const latest = new Map<string, string>()
  for (const r of requests) if (!latest.has(r.ministryId)) latest.set(r.ministryId, r.status)
  return ministries.map((m) => ({
    ...m,
    state: inMinistry.has(m.id) ? "member" : latest.get(m.id) === "pending" ? "pending" : latest.get(m.id) === "rejected" ? "rejected" : "none",
  }))
}

export async function requestJoin(actor: Actor, ministryId: string, message: unknown) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu cuenta aún no está ligada a un registro de la iglesia", 409)
  const ministry = await prisma.ministry.findFirst({ where: { id: ministryId, organizationId: actor.organizationId, isActive: true }, select: { id: true } })
  if (!ministry) throw new CrudError("Ministerio no encontrado", 404)
  const already = await prisma.ministryMember.findFirst({ where: { ministryId, memberId, isActive: true }, select: { id: true } })
  if (already) throw new CrudError("Ya sirves en este ministerio", 409)
  const pending = await prisma.ministryJoinRequest.findFirst({ where: { ministryId, memberId, status: "pending" }, select: { id: true } })
  if (pending) throw new CrudError("Ya tienes una solicitud en revisión", 409)
  const row = await prisma.ministryJoinRequest.create({
    data: { organizationId: actor.organizationId, ministryId, memberId, message: text(message, 500) },
  })
  const who = await prisma.member.findUnique({ where: { id: memberId }, select: { fullName: true } })
  const mi = await prisma.ministry.findUnique({ where: { id: ministryId }, select: { name: true } })
  fireAndForget(
    notifyMinistryLeaders(actor.organizationId, ministryId, {
      kind: "ministry_request",
      title: "Quieren servir en tu ministerio",
      body: `${who?.fullName ?? "Un creyente"} pidió unirse a ${mi?.name ?? "tu ministerio"}.`,
      link: "/mi/ministerios",
      excludeUserId: actor.userId,
    })
  )
  return { id: row.id }
}

export interface JoinRequestDto {
  id: string
  ministryId: string
  ministryName: string
  memberName: string
  message: string | null
  createdAt: string
}

/** Ministerios que la persona puede decidir: los que lidera/asiste, o todos con permiso global. */
async function decidableMinistryIds(actor: Actor): Promise<string[] | "all"> {
  if (actor.canManageAll) return "all"
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.ministryMember.findMany({
    where: { memberId, isActive: true, role: { in: ["leader", "assistant"] }, organizationId: actor.organizationId },
    select: { ministryId: true },
  })
  return rows.map((r) => r.ministryId)
}

async function countPendingJoinRequests(actor: Actor): Promise<number> {
  const ids = await decidableMinistryIds(actor)
  if (ids !== "all" && ids.length === 0) return 0
  return prisma.ministryJoinRequest.count({
    where: { organizationId: actor.organizationId, status: "pending", ...(ids === "all" ? {} : { ministryId: { in: ids } }) },
  })
}

export async function listJoinRequests(actor: Actor): Promise<JoinRequestDto[]> {
  const ids = await decidableMinistryIds(actor)
  if (ids !== "all" && ids.length === 0) return []
  const rows = await prisma.ministryJoinRequest.findMany({
    where: { organizationId: actor.organizationId, status: "pending", ...(ids === "all" ? {} : { ministryId: { in: ids } }) },
    orderBy: { createdAt: "asc" },
    include: { ministry: { select: { name: true } }, member: { select: { fullName: true } } },
    take: 100,
  })
  return rows.map((r) => ({
    id: r.id,
    ministryId: r.ministryId,
    ministryName: r.ministry.name,
    memberName: r.member.fullName,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function decideJoinRequest(actor: Actor, requestId: string, decision: unknown) {
  if (decision !== "approve" && decision !== "reject") throw new CrudError("Decisión inválida", 400, "decision")
  const req = await prisma.ministryJoinRequest.findFirst({ where: { id: requestId, organizationId: actor.organizationId } })
  if (!req) throw new CrudError("Solicitud no encontrada", 404)
  const ids = await decidableMinistryIds(actor)
  if (ids !== "all" && !ids.includes(req.ministryId)) throw new CrudError("Solicitud no encontrada", 404)
  if (req.status !== "pending") throw new CrudError("La solicitud ya fue resuelta", 409)
  const status = decision === "approve" ? "approved" : "rejected"
  await prisma.$transaction(async (tx) => {
    await tx.ministryJoinRequest.update({ where: { id: requestId }, data: { status, decidedById: actor.userId, decidedAt: new Date() } })
    if (decision === "approve") {
      await tx.ministryMember.upsert({
        where: { ministryId_memberId: { ministryId: req.ministryId, memberId: req.memberId } },
        update: { isActive: true },
        create: { organizationId: actor.organizationId, ministryId: req.ministryId, memberId: req.memberId, role: "servant" },
      })
    }
  })
  const ministry = await prisma.ministry.findUnique({ where: { id: req.ministryId }, select: { name: true } })
  fireAndForget(
    notifyMembers(actor.organizationId, [req.memberId], {
      kind: "ministry_decision",
      severity: status === "approved" ? "success" : "info",
      title: status === "approved" ? "¡Ya sirves en un ministerio!" : "Tu solicitud fue revisada",
      body: status === "approved" ? `Te integraron a ${ministry?.name ?? "el ministerio"}.` : `Por ahora no es posible integrarte a ${ministry?.name ?? "ese ministerio"}.`,
      link: "/mi/ministerios",
    })
  )
  return { ok: true, status }
}
