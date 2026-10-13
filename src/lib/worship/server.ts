import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, ministryAccess, type Actor } from "@/lib/ministries/server"
import {
  canResolveAudition,
  isAuditionStatus,
  isRosterStatus,
  monthRange,
  normalizeKey,
  sanitizeLinks,
  toYmd,
  weekStartOf,
  type AuditionStatusKey,
  type RosterStatusKey,
  type SongLink,
} from "@/lib/worship/rules"

// Alabanza: catálogo de canciones, programa semanal, rol y audiciones.
// El ministerio de alabanza es un `Ministry` con kind = "worship"; el acceso fino
// reutiliza `ministryAccess` (permiso global ∪ papel en el ministerio).
//
//  - Ver (programa, rol, canciones): permiso global o pertenecer al ministerio.
//  - Editar programa, rol y canciones: líder, apoyo o permiso global de gestión.
//  - Audiciones: líder o permiso global.
//  - Confirmar su lugar en el rol: la propia persona.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

async function worshipAccess(actor: Actor, ministryId: string) {
  const access = await ministryAccess(actor, ministryId)
  const ministry = await prisma.ministry.findFirst({
    where: { id: ministryId, organizationId: actor.organizationId },
    select: { kind: true },
  })
  if (!ministry || ministry.kind !== "worship" || !access.canView) throw new CrudError("Ministerio no encontrado", 404)
  const canEdit = access.canManage || access.myRole === "assistant"
  return { access, canEdit, canManage: access.canManage }
}

function assertEdit(a: { canEdit: boolean }) {
  if (!a.canEdit) throw new CrudError("No tienes permiso para editar en Alabanza", 403)
}
function assertManage(a: { canManage: boolean }) {
  if (!a.canManage) throw new CrudError("Solo el líder del ministerio puede hacer esto", 403)
}

/** Ministerios de alabanza que el actor puede ver (para ubicar su espacio). */
export async function listWorshipMinistries(actor: Actor) {
  const rows = await prisma.ministry.findMany({
    where: { organizationId: actor.organizationId, kind: "worship", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const out: { id: string; name: string }[] = []
  for (const r of rows) {
    try {
      await worshipAccess(actor, r.id)
      out.push(r)
    } catch {
      /* sin acceso */
    }
  }
  return out
}

// ── Canciones ────────────────────────────────────────────────────────────────

export interface SongDto {
  id: string
  title: string
  artist: string | null
  songKey: string | null
  bpm: number | null
  /** La lista no trae la letra (pesa); el detalle sí. */
  lyrics: string | null
  hasLyrics: boolean
  notes: string | null
  imageUrl: string | null
  links: SongLink[]
  isActive: boolean
}

type SongRow = Awaited<ReturnType<typeof prisma.song.findFirstOrThrow>>

const songDto = (s: SongRow, withLyrics = true): SongDto => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  songKey: s.songKey,
  bpm: s.bpm,
  lyrics: withLyrics ? s.lyrics : null,
  hasLyrics: Boolean(s.lyrics),
  notes: s.notes,
  imageUrl: s.imageUrl,
  links: sanitizeLinks(s.links),
  isActive: s.isActive,
})

/** Lectura del catálogo: permiso global o pertenecer a un ministerio de alabanza. */
async function songsAccess(actor: Actor) {
  if (actor.canViewAll || actor.canManageAll) return { canRead: true, canWrite: actor.canManageAll }
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return { canRead: false, canWrite: false }
  const rows = await prisma.ministryMember.findMany({
    where: { organizationId: actor.organizationId, memberId, isActive: true, ministry: { kind: "worship", isActive: true } },
    select: { role: true },
  })
  return {
    canRead: rows.length > 0,
    canWrite: rows.some((r) => r.role === "leader" || r.role === "assistant"),
  }
}

export async function listSongs(actor: Actor, q: string, includeInactive = false) {
  const a = await songsAccess(actor)
  if (!a.canRead) throw new CrudError("No tienes acceso al catálogo de canciones", 403)
  const term = q.trim()
  const rows = await prisma.song.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(includeInactive && a.canWrite ? {} : { isActive: true }),
      ...(term ? { OR: [{ title: { contains: term } }, { artist: { contains: term } }] } : {}),
    },
    orderBy: { title: "asc" },
    take: 300,
  })
  return { songs: rows.map((r) => songDto(r, false)), canWrite: a.canWrite }
}

export async function getSong(actor: Actor, id: string) {
  const a = await songsAccess(actor)
  if (!a.canRead) throw new CrudError("No tienes acceso al catálogo de canciones", 403)
  const row = await prisma.song.findFirst({ where: { id, organizationId: actor.organizationId } })
  if (!row) throw new CrudError("Canción no encontrada", 404)
  return { song: songDto(row), canWrite: a.canWrite }
}

export async function saveSong(actor: Actor, id: string | null, input: Record<string, unknown>) {
  const a = await songsAccess(actor)
  if (!a.canWrite) throw new CrudError("No tienes permiso para editar canciones", 403)
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el título", 400, "title")
  let songKey: string | null = null
  if (input.songKey !== undefined && input.songKey !== null && input.songKey !== "") {
    songKey = normalizeKey(input.songKey)
    if (!songKey) throw new CrudError("Tono no válido (ej. G, F#m, Bb)", 400, "songKey")
  }
  let bpm: number | null = null
  if (input.bpm !== undefined && input.bpm !== null && input.bpm !== "") {
    const n = Number(input.bpm)
    if (!Number.isInteger(n) || n < 30 || n > 300) throw new CrudError("BPM entre 30 y 300", 400, "bpm")
    bpm = n
  }
  const data = {
    title,
    artist: text(input.artist, 150),
    songKey,
    bpm,
    lyrics: text(input.lyrics, 20000),
    notes: text(input.notes, 2000),
    imageUrl: text(input.imageUrl, 500),
    links: sanitizeLinks(input.links) as unknown as object,
    ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
  }
  if (id) {
    const existing = await prisma.song.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } })
    if (!existing) throw new CrudError("Canción no encontrada", 404)
    return songDto(await prisma.song.update({ where: { id }, data }))
  }
  return songDto(await prisma.song.create({ data: { organizationId: actor.organizationId, ...data } }))
}

export async function inactivateSong(actor: Actor, id: string) {
  const a = await songsAccess(actor)
  if (!a.canWrite) throw new CrudError("No tienes permiso para editar canciones", 403)
  const r = await prisma.song.updateMany({ where: { id, organizationId: actor.organizationId }, data: { isActive: false } })
  if (r.count === 0) throw new CrudError("Canción no encontrada", 404)
}

// ── Programa semanal ─────────────────────────────────────────────────────────

export interface ProgramDto {
  weekStart: string
  title: string | null
  notes: string | null
  songs: { songId: string; title: string; artist: string | null; songKey: string | null; keyUsed: string | null; notes: string | null; hasLyrics: boolean }[]
  exists: boolean
  canEdit: boolean
  /** Semanas recientes con programa (para el historial). */
  history: { weekStart: string; count: number }[]
}

export async function getProgram(actor: Actor, ministryId: string, week: string): Promise<ProgramDto> {
  const a = await worshipAccess(actor, ministryId)
  const weekStart = weekStartOf(week)
  const [program, history] = await Promise.all([
    prisma.worshipProgram.findUnique({
      where: { ministryId_weekStart: { ministryId, weekStart } },
      include: { songs: { orderBy: { position: "asc" }, include: { song: true } } },
    }),
    prisma.worshipProgram.findMany({
      where: { ministryId, organizationId: actor.organizationId },
      orderBy: { weekStart: "desc" },
      take: 16,
      select: { weekStart: true, _count: { select: { songs: true } } },
    }),
  ])
  return {
    weekStart: toYmd(weekStart),
    title: program?.title ?? null,
    notes: program?.notes ?? null,
    exists: Boolean(program),
    canEdit: a.canEdit,
    songs: (program?.songs ?? []).map((p) => ({
      songId: p.songId,
      title: p.song.title,
      artist: p.song.artist,
      songKey: p.song.songKey,
      keyUsed: p.keyUsed,
      notes: p.notes,
      hasLyrics: Boolean(p.song.lyrics),
    })),
    history: history.map((h) => ({ weekStart: toYmd(h.weekStart), count: h._count.songs })),
  }
}

export async function saveProgram(
  actor: Actor,
  ministryId: string,
  week: string,
  input: { title?: unknown; notes?: unknown; songs?: unknown }
) {
  const a = await worshipAccess(actor, ministryId)
  assertEdit(a)
  const weekStart = weekStartOf(week)
  const raw = Array.isArray(input.songs) ? (input.songs as Record<string, unknown>[]) : []
  if (raw.length > 30) throw new CrudError("Demasiadas canciones en el programa", 400)
  const songIds = raw.map((s) => text(s.songId, 40))
  if (songIds.some((s) => !s)) throw new CrudError("Canción inválida", 400)
  const found = await prisma.song.findMany({
    where: { id: { in: songIds as string[] }, organizationId: actor.organizationId, isActive: true },
    select: { id: true },
  })
  const valid = new Set(found.map((f) => f.id))
  if ((songIds as string[]).some((id) => !valid.has(id))) throw new CrudError("El programa incluye una canción que no existe o está inactiva", 400)
  const rows = raw.map((s, i) => {
    const keyUsed = s.keyUsed === undefined || s.keyUsed === null || s.keyUsed === "" ? null : normalizeKey(s.keyUsed)
    if (s.keyUsed && !keyUsed) throw new CrudError("Tono no válido en el programa", 400)
    return { organizationId: actor.organizationId, songId: songIds[i] as string, position: i + 1, keyUsed, notes: text(s.notes, 200) }
  })

  await prisma.$transaction(async (tx) => {
    const program = await tx.worshipProgram.upsert({
      where: { ministryId_weekStart: { ministryId, weekStart } },
      update: { title: text(input.title, 150), notes: text(input.notes, 1000) },
      create: {
        organizationId: actor.organizationId,
        ministryId,
        weekStart,
        title: text(input.title, 150),
        notes: text(input.notes, 1000),
        createdByUserId: actor.userId,
      },
    })
    await tx.worshipProgramSong.deleteMany({ where: { programId: program.id } })
    if (rows.length) await tx.worshipProgramSong.createMany({ data: rows.map((r) => ({ ...r, programId: program.id })) })
  })
}

// ── Rol (quién toca en qué servicio) ─────────────────────────────────────────

export interface RosterEntryDto {
  id: string
  serviceAt: string
  serviceLabel: string | null
  memberId: string
  fullName: string
  instrument: string | null
  status: RosterStatusKey
  mine: boolean
}

export async function getRoster(actor: Actor, ministryId: string, month: string) {
  const a = await worshipAccess(actor, ministryId)
  const { from, to } = monthRange(month)
  const [entries, servers] = await Promise.all([
    prisma.worshipRosterEntry.findMany({
      where: { ministryId, organizationId: actor.organizationId, serviceAt: { gte: from, lt: to } },
      orderBy: [{ serviceAt: "asc" }, { member: { fullName: "asc" } }],
      include: { member: { select: { fullName: true } } },
    }),
    a.canEdit
      ? prisma.ministryMember.findMany({
          where: { ministryId, organizationId: actor.organizationId, isActive: true, member: { isActive: true } },
          select: { memberId: true, member: { select: { fullName: true } } },
          orderBy: { member: { fullName: "asc" } },
        })
      : Promise.resolve([]),
  ])
  return {
    month,
    canEdit: a.canEdit,
    entries: entries.map<RosterEntryDto>((e) => ({
      id: e.id,
      serviceAt: e.serviceAt.toISOString(),
      serviceLabel: e.serviceLabel,
      memberId: e.memberId,
      fullName: e.member.fullName,
      instrument: e.instrument,
      status: e.status as RosterStatusKey,
      mine: e.memberId === a.access.memberId,
    })),
    servers: servers.map((s) => ({ memberId: s.memberId, fullName: s.member.fullName })),
  }
}

export async function addRosterEntry(
  actor: Actor,
  ministryId: string,
  input: { memberId?: unknown; serviceAt?: unknown; serviceLabel?: unknown; instrument?: unknown }
) {
  const a = await worshipAccess(actor, ministryId)
  assertEdit(a)
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige a quién asignas", 400, "memberId")
  const serviceAt = new Date(String(input.serviceAt ?? ""))
  if (Number.isNaN(serviceAt.getTime())) throw new CrudError("Fecha y hora inválidas", 400, "serviceAt")
  const server = await prisma.ministryMember.findFirst({
    where: { ministryId, organizationId: actor.organizationId, memberId, isActive: true },
    select: { id: true },
  })
  if (!server) throw new CrudError("La persona no pertenece al ministerio", 400, "memberId")
  try {
    const row = await prisma.worshipRosterEntry.create({
      data: {
        organizationId: actor.organizationId,
        ministryId,
        memberId,
        serviceAt,
        serviceLabel: text(input.serviceLabel, 80),
        instrument: text(input.instrument, 60),
        createdByUserId: actor.userId,
      },
    })
    return { id: row.id }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      throw new CrudError("Esa persona ya está asignada a ese servicio", 409, "memberId")
    }
    throw err
  }
}

async function rosterEntry(actor: Actor, id: string) {
  const entry = await prisma.worshipRosterEntry.findFirst({ where: { id, organizationId: actor.organizationId } })
  if (!entry) throw new CrudError("Asignación no encontrada", 404)
  const a = await worshipAccess(actor, entry.ministryId)
  return { entry, a }
}

export async function removeRosterEntry(actor: Actor, id: string) {
  const { entry, a } = await rosterEntry(actor, id)
  assertEdit(a)
  await prisma.worshipRosterEntry.delete({ where: { id: entry.id } })
}

/** La propia persona confirma o declina su lugar. */
export async function respondRoster(actor: Actor, id: string, status: unknown) {
  const { entry, a } = await rosterEntry(actor, id)
  if (!isRosterStatus(status) || status === "pending") throw new CrudError("Respuesta inválida", 400)
  if (!a.access.memberId || entry.memberId !== a.access.memberId) {
    throw new CrudError("Solo la persona asignada puede responder", 403)
  }
  await prisma.worshipRosterEntry.update({ where: { id: entry.id }, data: { status, respondedAt: new Date() } })
}

// ── Audiciones ───────────────────────────────────────────────────────────────

export interface AuditionDto {
  id: string
  memberId: string
  fullName: string
  instrument: string | null
  scheduledAt: string
  status: AuditionStatusKey
  notes: string | null
  decidedAt: string | null
  alreadyServes: boolean
}

export async function listAuditions(actor: Actor, ministryId: string) {
  const a = await worshipAccess(actor, ministryId)
  assertManage(a)
  const rows = await prisma.worshipAudition.findMany({
    where: { ministryId, organizationId: actor.organizationId },
    orderBy: { scheduledAt: "desc" },
    take: 100,
    include: { member: { select: { fullName: true } } },
  })
  const serving = await prisma.ministryMember.findMany({
    where: { ministryId, organizationId: actor.organizationId, isActive: true, memberId: { in: rows.map((r) => r.memberId) } },
    select: { memberId: true },
  })
  const servingIds = new Set(serving.map((s) => s.memberId))
  return rows.map<AuditionDto>((r) => ({
    id: r.id,
    memberId: r.memberId,
    fullName: r.member.fullName,
    instrument: r.instrument,
    scheduledAt: r.scheduledAt.toISOString(),
    status: r.status as AuditionStatusKey,
    notes: r.notes,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    alreadyServes: servingIds.has(r.memberId),
  }))
}

export async function scheduleAudition(
  actor: Actor,
  ministryId: string,
  input: { memberId?: unknown; instrument?: unknown; scheduledAt?: unknown; notes?: unknown }
) {
  const a = await worshipAccess(actor, ministryId)
  assertManage(a)
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige al creyente", 400, "memberId")
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: actor.organizationId, isActive: true },
    select: { id: true },
  })
  if (!member) throw new CrudError("El creyente no existe en esta iglesia", 400, "memberId")
  const scheduledAt = new Date(String(input.scheduledAt ?? ""))
  if (Number.isNaN(scheduledAt.getTime())) throw new CrudError("Fecha y hora inválidas", 400, "scheduledAt")
  const open = await prisma.worshipAudition.findFirst({
    where: { ministryId, organizationId: actor.organizationId, memberId, status: "scheduled" },
    select: { id: true },
  })
  if (open) throw new CrudError("Esa persona ya tiene una audición programada", 409, "memberId")
  const row = await prisma.worshipAudition.create({
    data: {
      organizationId: actor.organizationId,
      ministryId,
      memberId,
      instrument: text(input.instrument, 60),
      scheduledAt,
      notes: text(input.notes, 1000),
    },
  })
  return { id: row.id }
}

export async function resolveAudition(
  actor: Actor,
  auditionId: string,
  input: { status?: unknown; notes?: unknown; addToMinistry?: unknown }
) {
  const audition = await prisma.worshipAudition.findFirst({ where: { id: auditionId, organizationId: actor.organizationId } })
  if (!audition) throw new CrudError("Audición no encontrada", 404)
  const a = await worshipAccess(actor, audition.ministryId)
  assertManage(a)
  if (!isAuditionStatus(input.status)) throw new CrudError("Estado inválido", 400)
  if (!canResolveAudition(audition.status as AuditionStatusKey, input.status)) {
    throw new CrudError("Esta audición ya fue resuelta", 409)
  }
  await prisma.$transaction(async (tx) => {
    await tx.worshipAudition.update({
      where: { id: audition.id },
      data: {
        status: input.status as AuditionStatusKey,
        notes: input.notes !== undefined ? text(input.notes, 1000) : audition.notes,
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
      },
    })
    // Al aprobar, la persona puede integrarse como servidora (conserva su historial).
    if (input.status === "passed" && input.addToMinistry === true) {
      await tx.ministryMember.upsert({
        where: { ministryId_memberId: { ministryId: audition.ministryId, memberId: audition.memberId } },
        update: { isActive: true },
        create: {
          organizationId: actor.organizationId,
          ministryId: audition.ministryId,
          memberId: audition.memberId,
          role: "servant",
          positionTitle: audition.instrument,
        },
      })
    }
  })
}

