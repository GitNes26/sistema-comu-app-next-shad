import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { fireAndForget, notifyMembers, notifyMinistryLeaders, notifyPermission } from "@/lib/notifications/church"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { listOpenCampaigns, type CampaignDto } from "@/lib/finance/campaigns"
import {
  CARD_KINDS,
  digitsOf,
  isCardStatus,
  isPrayerStatus,
  isPrayerVisibility,
  validateCard,
  type CardStatus,
  type PrayerStatus,
  type PrayerVisibility,
} from "@/lib/connect/rules"

// Cara pública, tarjetas de conexión y oración.
//  - Público: `getPublicChurch` y `submitConnection` (sin sesión; se aíslan por la iglesia
//    cuyo `publicSlug` coincide y solo si `publicEnabled`).
//  - Equipo (members.manage): bandeja de tarjetas y de oración.
//  - Creyente: manda y ve SUS peticiones de oración.

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const txt = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

// ── Cara pública ─────────────────────────────────────────────────────────────

export interface PublicSlotDto {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  modality: string
  description: string | null
}
export interface PublicChurchDto {
  slug: string
  name: string
  tagline: string | null
  description: string | null
  pastor: { name: string | null; message: string | null }
  logoUrl: string | null
  heroImageUrl: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  mapUrl: string | null
  social: Record<string, string>
  schedule: PublicSlotDto[]
  events: { id: string; name: string; startsAt: string; location: string | null; price: number; imageUrl: string | null }[]
  stream: { title: string; platform: string; url: string; embedUrl: string | null; status: string } | null
  hue: { primary: number; accent: number } | null
  campaigns: CampaignDto[]
  giving: { bank: string | null; holder: string | null; clabe: string | null; account: string | null; note: string | null; link: string | null } | null
}

export async function getPublicChurch(slug: string): Promise<PublicChurchDto | null> {
  const profile = await prisma.companyProfile.findFirst({
    where: { publicSlug: slug, publicEnabled: true },
    select: {
      organizationId: true,
      publicSlug: true,
      tradeName: true,
      legalName: true,
      tagline: true,
      description: true,
      pastorName: true,
      pastorMessage: true,
      logoUrl: true,
      heroImageUrl: true,
      address: true,
      city: true,
      phone: true,
      email: true,
      mapUrl: true,
      socialLinks: true,
      publicGiving: true,
      donationsEnabled: true,
      donationBank: true,
      donationHolder: true,
      donationClabe: true,
      donationAccount: true,
      donationNote: true,
      donationLink: true,
      organization: { select: { name: true, isBlocked: true, appSettings: { select: { primaryHue: true, accentHue: true } } } },
    },
  })
  if (!profile || profile.organization.isBlocked) return null
  const organizationId = profile.organizationId

  const [series, events, stream, campaigns] = await Promise.all([
    prisma.gatheringSeries.findMany({
      where: { organizationId, isActive: true, isPublic: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { id: true, name: true, dayOfWeek: true, startTime: true, endTime: true, modality: true, description: true },
    }),
    prisma.event.findMany({
      where: { organizationId, status: "published", audience: "open", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 4,
      select: { id: true, name: true, startsAt: true, location: true, price: true, imageUrl: true },
    }),
    prisma.stream.findFirst({
      where: { organizationId, isPublished: true, status: { in: ["live", "scheduled"] } },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
      select: { title: true, platform: true, url: true, status: true },
    }),
    profile.publicGiving ? listOpenCampaigns(organizationId, { publicOnly: true }) : Promise.resolve([] as CampaignDto[]),
  ])

  const social = Object.fromEntries(
    Object.entries((profile.socialLinks ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string" && v)
  ) as Record<string, string>

  return {
    slug: profile.publicSlug!,
    name: profile.tradeName ?? profile.legalName ?? profile.organization.name,
    tagline: profile.tagline,
    description: profile.description,
    pastor: { name: profile.pastorName, message: profile.pastorMessage },
    logoUrl: profile.logoUrl,
    heroImageUrl: profile.heroImageUrl,
    address: profile.address,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    mapUrl: profile.mapUrl,
    social,
    schedule: series,
    events: events.map((e) => ({ id: e.id, name: e.name, startsAt: e.startsAt.toISOString(), location: e.location, price: Number(e.price), imageUrl: e.imageUrl })),
    stream: stream ? { ...stream, embedUrl: null } : null,
    campaigns,
    giving:
      profile.publicGiving && profile.donationsEnabled
        ? { bank: profile.donationBank, holder: profile.donationHolder, clabe: profile.donationClabe, account: profile.donationAccount, note: profile.donationNote, link: profile.donationLink }
        : null,
    hue: profile.organization.appSettings ? { primary: profile.organization.appSettings.primaryHue, accent: profile.organization.appSettings.accentHue } : null,
  }
}

// ── Recepción pública ────────────────────────────────────────────────────────

// Freno básico por proceso: 5 envíos cada 10 minutos por IP+iglesia. Suficiente contra
// repeticiones accidentales; el relleno masivo lo frena además el límite por contacto.
const hits = new Map<string, number[]>()
function tooMany(key: string) {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000)
  if (list.length >= 5) {
    hits.set(key, list)
    return true
  }
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return false
}

export async function submitConnection(slug: string, ip: string, input: Record<string, unknown>) {
  // Campo trampa: un robot lo llena, una persona no lo ve.
  if (typeof input.website === "string" && input.website.trim()) return { ok: true as const }
  if (tooMany(`${slug}:${ip}`)) throw new CrudError("Enviaste varias solicitudes seguidas. Intenta de nuevo en unos minutos.", 429)

  const profile = await prisma.companyProfile.findFirst({
    where: { publicSlug: slug, publicEnabled: true },
    select: { organizationId: true, tradeName: true },
  })
  if (!profile) throw new CrudError("Iglesia no encontrada", 404)
  const organizationId = profile.organizationId

  const v = validateCard(input)
  if (!v.ok) throw new CrudError(v.error, 400, v.field)
  const card = v.value

  // Oración: no es una tarjeta; va directo a la bandeja de intercesión.
  if (card.kind === "prayer") {
    await prisma.prayerRequest.create({
      data: { organizationId, name: card.name === "Anónimo" ? null : card.name, contact: card.phone ?? card.email, body: card.message!, visibility: "team", source: "public" },
    })
    fireAndForget(
      notifyPermission(organizationId, "members.manage", {
        kind: "prayer",
        title: "Nueva petición de oración",
        body: "Llegó desde la página pública.",
        link: "/admin/connect",
      })
    )
    return { ok: true as const }
  }

  // La misma persona con la misma petición abierta no duplica la bandeja.
  const digits = digitsOf(card.phone)
  const dup = await prisma.connectionCard.findFirst({
    where: {
      organizationId,
      kind: card.kind,
      status: { in: ["new", "contacted"] },
      createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
      OR: [...(digits ? [{ phone: card.phone! }] : []), ...(card.email ? [{ email: card.email }] : [])],
    },
    select: { id: true },
  })
  if (dup) return { ok: true as const, duplicate: true }

  let memberId: string | null = null
  if (card.kind === "visitor") {
    memberId = await registerVisitor(organizationId, card)
  }
  await prisma.connectionCard.create({
    data: {
      organizationId,
      kind: card.kind,
      name: card.name,
      phone: card.phone,
      email: card.email,
      message: card.message,
      interest: card.interest,
      memberId,
    },
  })
  fireAndForget(
    notifyPermission(organizationId, "members.manage", {
      kind: "connection_card",
      title: `${CARD_KINDS[card.kind]}: ${card.name}`.slice(0, 120),
      body: "Llegó una nueva tarjeta de conexión.",
      link: "/admin/connect",
    })
  )
  return { ok: true as const }
}

/** «Soy nuevo»: entra al padrón y a Consolidación (si la iglesia tiene ese ministerio). */
async function registerVisitor(organizationId: string, card: { name: string; phone: string | null; email: string | null; message: string | null }) {
  const digits = digitsOf(card.phone)
  const existing = await prisma.member.findFirst({
    where: {
      organizationId,
      isActive: true,
      OR: [...(digits ? [{ phone: { contains: digits } }] : []), ...(card.email ? [{ email: card.email }] : [])],
    },
    select: { id: true },
  })
  const consolidation = await prisma.ministry.findFirst({
    where: { organizationId, kind: "consolidation", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  const today = new Date(`${ymd(new Date())}T00:00:00.000Z`)
  let memberId = existing?.id ?? null
  if (!memberId) {
    const m = await prisma.member.create({
      data: {
        organizationId,
        fullName: card.name,
        phone: card.phone,
        email: card.email,
        firstVisitAt: today,
        hierarchy: "believer",
        visionStage: "win",
        notes: "Llegó por «Soy nuevo» (cara pública).",
      },
      select: { id: true },
    })
    await prisma.memberStageLog.create({ data: { organizationId, memberId: m.id, stage: "win", note: "Tarjeta «Soy nuevo»" } })
    memberId = m.id
  }
  if (consolidation) {
    const has = await prisma.consolidationCase.findFirst({ where: { ministryId: consolidation.id, memberId }, select: { id: true } })
    if (!has) {
      await prisma.consolidationCase.create({
        data: {
          organizationId,
          ministryId: consolidation.id,
          memberId,
          visitedAt: today,
          serviceLabel: "Cara pública",
          notes: card.message?.slice(0, 2000) ?? null,
        },
      })
      fireAndForget(
        notifyMinistryLeaders(organizationId, consolidation.id, {
          kind: "consolidation_new",
          title: `Nueva persona: ${card.name}`.slice(0, 120),
          body: "Pidió que lo contacten desde «Soy nuevo».",
          link: `/mi/ministerios/${consolidation.id}/consolidacion`,
        })
      )
    }
  }
  return memberId
}

// ── Bandeja del equipo (members.manage) ──────────────────────────────────────

function assertTeam(actor: Actor) {
  if (!actor.canManageMembers) throw new CrudError("No tienes permiso para esta bandeja", 403)
}

export interface CardDto {
  id: string
  kind: string
  name: string
  phone: string | null
  email: string | null
  message: string | null
  interest: string | null
  status: CardStatus
  memberId: string | null
  handledNote: string | null
  createdAt: string
}

export async function listCards(actor: Actor): Promise<CardDto[]> {
  assertTeam(actor)
  const rows = await prisma.connectionCard.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    phone: r.phone,
    email: r.email,
    message: r.message,
    interest: r.interest,
    status: isCardStatus(r.status) ? r.status : "new",
    memberId: r.memberId,
    handledNote: r.handledNote,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function updateCard(actor: Actor, id: string, input: { status?: unknown; handledNote?: unknown }) {
  assertTeam(actor)
  const row = await prisma.connectionCard.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } })
  if (!row) throw new CrudError("Tarjeta no encontrada", 404)
  if (input.status !== undefined && !isCardStatus(input.status)) throw new CrudError("Estado inválido", 400, "status")
  await prisma.connectionCard.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status as string, handledAt: input.status === "new" ? null : new Date() } : {}),
      ...(input.handledNote !== undefined ? { handledNote: txt(input.handledNote, 300) } : {}),
    },
  })
  return { ok: true }
}

// ── Oración ──────────────────────────────────────────────────────────────────

export interface PrayerDto {
  id: string
  body: string
  status: PrayerStatus
  visibility: PrayerVisibility
  answeredNote: string | null
  name: string | null
  contact: string | null
  mine: boolean
  source: string
  createdAt: string
}

const prayerDto = (r: {
  id: string
  body: string
  status: string
  visibility: string
  answeredNote: string | null
  name: string | null
  contact: string | null
  memberId: string | null
  source: string
  createdAt: Date
  member?: { fullName: string; phone: string | null } | null
}, mineId: string | null): PrayerDto => ({
  id: r.id,
  body: r.body,
  status: isPrayerStatus(r.status) ? r.status : "open",
  visibility: isPrayerVisibility(r.visibility) ? r.visibility : "team",
  answeredNote: r.answeredNote,
  name: r.name ?? r.member?.fullName ?? null,
  contact: r.contact ?? r.member?.phone ?? null,
  mine: Boolean(mineId && r.memberId === mineId),
  source: r.source,
  createdAt: r.createdAt.toISOString(),
})

/** Peticiones propias del creyente. */
export async function myPrayers(actor: Actor): Promise<PrayerDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.prayerRequest.findMany({
    where: { organizationId: actor.organizationId, memberId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map((r) => prayerDto(r, memberId))
}

export async function createPrayer(actor: Actor, input: { body?: unknown; visibility?: unknown }) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu cuenta aún no está ligada a tu registro; pide ayuda en secretaría", 409)
  const body = txt(input.body, 1500)
  if (!body || body.length < 3) throw new CrudError("Cuéntanos por qué quieres que oremos", 400, "body")
  const visibility = isPrayerVisibility(input.visibility) ? input.visibility : "team"
  const row = await prisma.prayerRequest.create({
    data: { organizationId: actor.organizationId, memberId, body, visibility, source: "portal" },
    select: { id: true },
  })
  fireAndForget(
    notifyPermission(actor.organizationId, "members.manage", {
      kind: "prayer",
      title: "Nueva petición de oración",
      body: visibility === "leaders" ? "Es solo para pastoral." : "Para el equipo de intercesión.",
      link: "/admin/connect",
      excludeUserId: actor.userId,
    })
  )
  return { id: row.id }
}

/** El creyente marca su propia petición como respondida (y puede dejar su testimonio). */
export async function answerMyPrayer(actor: Actor, id: string, note: unknown) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const row = await prisma.prayerRequest.findFirst({ where: { id, organizationId: actor.organizationId, memberId: memberId ?? "-" }, select: { id: true } })
  if (!row) throw new CrudError("Petición no encontrada", 404)
  await prisma.prayerRequest.update({ where: { id }, data: { status: "answered", answeredAt: new Date(), answeredNote: txt(note, 300) } })
  return { ok: true }
}

/** Equipo: ve las peticiones (las «solo pastoral» solo con `members.manage`, que ya es el requisito). */
export async function listPrayers(actor: Actor): Promise<PrayerDto[]> {
  assertTeam(actor)
  const rows = await prisma.prayerRequest.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { member: { select: { fullName: true, phone: true } } },
  })
  return rows.map((r) => prayerDto(r, null))
}

export async function updatePrayer(actor: Actor, id: string, input: { status?: unknown }) {
  assertTeam(actor)
  if (!isPrayerStatus(input.status)) throw new CrudError("Estado inválido", 400, "status")
  const row = await prisma.prayerRequest.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true, memberId: true } })
  if (!row) throw new CrudError("Petición no encontrada", 404)
  await prisma.prayerRequest.update({
    where: { id },
    data: { status: input.status, answeredAt: input.status === "answered" ? new Date() : null },
  })
  if (input.status === "praying" && row.memberId) {
    fireAndForget(
      notifyMembers(actor.organizationId, [row.memberId], {
        kind: "prayer_update",
        title: "Estamos orando por ti",
        body: "El equipo de intercesión tomó tu petición.",
        link: "/mi/oracion",
        excludeUserId: actor.userId,
      })
    )
  }
  return { ok: true }
}
