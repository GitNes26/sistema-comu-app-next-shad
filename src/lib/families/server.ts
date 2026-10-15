import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { isFamilyRelation, type FamilyRelation } from "@/lib/families/rules"

// Familias: personas del padrón que viven o caminan juntas. NO es un hogar de amor
// (célula): una familia puede asistir a reuniones y ministerios distintos. La
// administra `members.manage`; cada persona ve solo la suya (nombres y parentesco).

export type { FamilyRelation } from "@/lib/families/rules"

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""
  return s ? s.slice(0, max) : null
}
function assertManage(actor: Actor) {
  if (!actor.canManageMembers) throw new CrudError("No tienes permiso para administrar familias", 403)
}

export interface FamilyMemberDto {
  memberId: string
  fullName: string
  relation: FamilyRelation
  phone: string | null
  /** «12 de marzo» (sin año). */
  birthday: string | null
}
export interface FamilyDto {
  id: string
  name: string
  notes: string | null
  members: FamilyMemberDto[]
}

const birthdayLabel = (d: Date | null) => (d ? d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" }) : null)

const include = {
  members: { include: { member: { select: { fullName: true, phone: true, birthDate: true } } }, orderBy: { createdAt: "asc" as const } },
} as const

function dto(f: { id: string; name: string; notes: string | null; members: { memberId: string; relation: string; member: { fullName: string; phone: string | null; birthDate: Date | null } }[] }, withPhone: boolean): FamilyDto {
  const order: FamilyRelation[] = ["head", "spouse", "child", "relative"]
  return {
    id: f.id,
    name: f.name,
    notes: f.notes,
    members: f.members
      .map((m) => ({
        memberId: m.memberId,
        fullName: m.member.fullName,
        relation: isFamilyRelation(m.relation) ? m.relation : ("relative" as const),
        phone: withPhone ? m.member.phone : null,
        birthday: birthdayLabel(m.member.birthDate),
      }))
      .sort((a, b) => order.indexOf(a.relation) - order.indexOf(b.relation)),
  }
}

export async function listFamilies(actor: Actor, q?: string): Promise<FamilyDto[]> {
  assertManage(actor)
  const rows = await prisma.family.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      ...(q?.trim() ? { OR: [{ name: { contains: q.trim() } }, { members: { some: { member: { fullName: { contains: q.trim() } } } } }] } : {}),
    },
    include,
    orderBy: { name: "asc" },
    take: 300,
  })
  return rows.map((r) => dto(r, true))
}

export async function saveFamily(actor: Actor, id: string | null, input: { name?: unknown; notes?: unknown }) {
  assertManage(actor)
  const name = text(input.name, 120)
  if (!name) throw new CrudError("Ponle nombre a la familia (p. ej. «Familia Pérez López»)", 400, "name")
  const data = { name, notes: text(input.notes, 500) }
  try {
    if (id) {
      const r = await prisma.family.updateMany({ where: { id, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Familia no encontrada", 404)
      return { id }
    }
    const row = await prisma.family.create({ data: { ...data, organizationId: actor.organizationId } })
    return { id: row.id }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") throw new CrudError("Ya existe una familia con ese nombre", 409, "name")
    throw err
  }
}

export async function deleteFamily(actor: Actor, id: string) {
  assertManage(actor)
  const f = await prisma.family.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } })
  if (!f) throw new CrudError("Familia no encontrada", 404)
  // Se desvincula a las personas y se conserva el registro (no se borra historia).
  await prisma.$transaction([prisma.familyMember.deleteMany({ where: { familyId: id } }), prisma.family.update({ where: { id }, data: { isActive: false } })])
  return { ok: true }
}

export async function addFamilyMember(actor: Actor, familyId: string, input: { memberId?: unknown; relation?: unknown }) {
  assertManage(actor)
  const family = await prisma.family.findFirst({ where: { id: familyId, organizationId: actor.organizationId, isActive: true }, select: { id: true } })
  if (!family) throw new CrudError("Familia no encontrada", 404)
  const memberId = text(input.memberId, 40)
  const member = memberId ? await prisma.member.findFirst({ where: { id: memberId, organizationId: actor.organizationId, isActive: true }, select: { id: true, fullName: true } }) : null
  if (!member) throw new CrudError("Elige a la persona", 400, "memberId")
  const other = await prisma.familyMember.findUnique({ where: { organizationId_memberId: { organizationId: actor.organizationId, memberId: member.id } }, select: { family: { select: { name: true } }, familyId: true } })
  if (other && other.familyId !== familyId) throw new CrudError(`${member.fullName} ya pertenece a «${other.family.name}»`, 409, "memberId")
  const relation: FamilyRelation = isFamilyRelation(input.relation) ? input.relation : "relative"
  await prisma.familyMember.upsert({
    where: { familyId_memberId: { familyId, memberId: member.id } },
    update: { relation },
    create: { organizationId: actor.organizationId, familyId, memberId: member.id, relation },
  })
  return { ok: true }
}

export async function removeFamilyMember(actor: Actor, familyId: string, memberId: string) {
  assertManage(actor)
  const r = await prisma.familyMember.deleteMany({ where: { familyId, memberId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("La persona no está en esa familia", 404)
  return { ok: true }
}

/** Personas para armar una familia, indicando si ya pertenecen a otra. */
export async function searchFamilyCandidates(actor: Actor, q: string) {
  assertManage(actor)
  const term = q.trim()
  if (term.length < 2) return []
  const rows = await prisma.member.findMany({
    where: { organizationId: actor.organizationId, isActive: true, OR: [{ fullName: { contains: term } }, { phone: { contains: term } }] },
    select: { id: true, fullName: true, phone: true, familyLinks: { select: { family: { select: { name: true } } }, take: 1 } },
    orderBy: { fullName: "asc" },
    take: 12,
  })
  return rows.map((m) => ({ id: m.id, fullName: m.fullName, phone: m.phone, familyName: m.familyLinks[0]?.family.name ?? null }))
}

/** La familia de quien consulta (sin teléfonos). */
export async function getMyFamily(actor: Actor): Promise<FamilyDto | null> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return null
  const link = await prisma.familyMember.findUnique({ where: { organizationId_memberId: { organizationId: actor.organizationId, memberId } }, select: { familyId: true } })
  if (!link) return null
  const f = await prisma.family.findFirst({ where: { id: link.familyId, organizationId: actor.organizationId, isActive: true }, include })
  return f ? dto(f, false) : null
}
