import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { rankByDistance } from "@/lib/cells/geo"
import { fireAndForget, notifyMembers } from "@/lib/notifications/church"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { matchesSearch } from "@/lib/search"

// Buscador de hogares de amor (células). «Grupo en casa», «hogar de amor» y «célula» son
// la MISMA cosa: aquí no se crea otro módulo, se consulta el de Células. La versión
// pública solo expone lo necesario para decidir (tipo, colonia, día y hora, distancia
// aproximada); nunca la calle, el anfitrión ni teléfonos.

export interface FoundCellDto {
  id: string
  name: string
  typeId: string | null
  typeName: string | null
  dayOfWeek: number
  startTime: string
  neighborhood: string | null
  city: string | null
  /** Distancia aproximada (a 0.5 km) desde el punto indicado; null si no hay coordenadas. */
  distanceKm: number | null
}
export interface CellSearch {
  lat?: number | null
  lng?: number | null
  typeId?: string | null
  q?: string | null
}
export interface CellSearchResult {
  types: { id: string; name: string }[]
  cells: FoundCellDto[]
  hasLocation: boolean
}

const round05 = (km: number) => Math.max(0.5, Math.round(km * 2) / 2)

export async function searchCells(organizationId: string, s: CellSearch): Promise<CellSearchResult> {
  const [types, rows] = await Promise.all([
    prisma.cellType.findMany({ where: { organizationId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.cell.findMany({
      where: { organizationId, isActive: true, ...(s.typeId ? { typeId: s.typeId } : {}) },
      select: { id: true, name: true, typeId: true, type: { select: { name: true } }, dayOfWeek: true, startTime: true, neighborhood: true, city: true, latitude: true, longitude: true },
    }),
  ])
  const q = s.q?.trim() ?? ""
  const filtered = rows.filter((c) => !q || matchesSearch(`${c.name} ${c.neighborhood ?? ""} ${c.city ?? ""} ${c.type?.name ?? ""}`, q))
  const items = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    typeId: c.typeId,
    typeName: c.type?.name ?? null,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    neighborhood: c.neighborhood,
    city: c.city,
    lat: c.latitude === null ? null : Number(c.latitude),
    lng: c.longitude === null ? null : Number(c.longitude),
  }))
  const hasLocation = typeof s.lat === "number" && typeof s.lng === "number" && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  const strip = ({ lat: _lat, lng: _lng, ...rest }: (typeof items)[number]) => {
    void _lat
    void _lng
    return rest
  }
  let cells: FoundCellDto[]
  if (hasLocation) {
    const ranked = rankByDistance(items, { lat: s.lat as number, lng: s.lng as number })
    const withoutGeo = items.filter((i) => i.lat === null || i.lng === null)
    cells = [
      ...ranked.map((r) => ({ ...strip(r), distanceKm: round05(r.distanceKm) })),
      ...withoutGeo.map((i) => ({ ...strip(i), distanceKm: null })),
    ]
  } else {
    cells = items
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      .map((i) => ({ ...strip(i), distanceKm: null }))
  }
  return { types, cells: cells.slice(0, 30), hasLocation }
}

/** Avisa a quienes lideran el hogar de amor de que alguien quiere unirse. */
export async function notifyCellLeaders(organizationId: string, cellId: string, personName: string, excludeUserId?: string | null) {
  const leaders = await prisma.cellMember.findMany({ where: { organizationId, cellId, isActive: true, role: "leader" }, select: { memberId: true } })
  const cell = await prisma.cell.findFirst({ where: { id: cellId, organizationId }, select: { name: true } })
  fireAndForget(
    notifyMembers(organizationId, leaders.map((l) => l.memberId), {
      kind: "cell_request",
      title: `${personName} quiere unirse a tu hogar de amor`,
      body: cell ? `Hogar: ${cell.name}. Contáctalo para darle la bienvenida.` : "Contáctalo para darle la bienvenida.",
      link: `/mi/celulas/${cellId}`,
      excludeUserId,
    })
  )
}

/** Un creyente con sesión pide unirse a un hogar de amor (usa sus propios datos). */
export async function requestCellAsMember(actor: Actor, cellId: unknown, message: unknown) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu cuenta aún no está ligada a tu registro; pide ayuda en secretaría", 409)
  const id = typeof cellId === "string" ? cellId : ""
  const cell = await prisma.cell.findFirst({ where: { id, organizationId: actor.organizationId, isActive: true }, select: { id: true, name: true, type: { select: { name: true } } } })
  if (!cell) throw new CrudError("Ese hogar de amor ya no está disponible", 404)
  const already = await prisma.cellMember.findFirst({ where: { memberId, isActive: true, cell: { isActive: true } }, select: { cell: { select: { name: true } } } })
  if (already) throw new CrudError(`Ya perteneces a «${already.cell.name}». Para cambiarte, pide un traspaso a tu líder.`, 409)
  const open = await prisma.connectionCard.findFirst({ where: { organizationId: actor.organizationId, memberId, cellId: cell.id, status: { in: ["new", "contacted"] } }, select: { id: true } })
  if (open) return { ok: true, duplicate: true }
  const person = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { fullName: true, phone: true, email: true } })
  await prisma.connectionCard.create({
    data: {
      organizationId: actor.organizationId,
      kind: "group",
      name: person.fullName,
      phone: person.phone,
      email: person.email,
      message: typeof message === "string" ? message.trim().slice(0, 500) || null : null,
      interest: cell.type?.name ?? null,
      cellId: cell.id,
      memberId,
    },
  })
  await notifyCellLeaders(actor.organizationId, cell.id, person.fullName, actor.userId)
  return { ok: true }
}
