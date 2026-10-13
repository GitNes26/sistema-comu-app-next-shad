import type { $Enums } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { hashPassword, normalizeIdentifier } from "@/lib/auth/users"
import { mailConfigured, sendWelcomeLink } from "@/lib/auth/mail"
import { listRoles } from "@/lib/settings/server"
import { roleAllowedInOrg, roleIdToEnum, ROLE_SCOPE_GATE_MESSAGE } from "@/lib/settings/system-roles"

// Helpers de servidor para la gestión de iglesias y de sus accesos
// (exclusivo del superadmin).

const VALID_ROLES: $Enums.OrgRole[] = ["owner", "admin", "leader", "servant", "believer"]

// Roles de sistema que nunca se asignan desde este diálogo.
const NON_ASSIGNABLE_SHARED_IDS = new Set(["system-superadmin"])

/** Roles de sistema asignables por el superadmin para una iglesia (se asignan por roleId). */
export async function assignableRolesFor(organizationId: string) {
  const roles = await listRoles(organizationId)
  return roles
    .filter((r) => r.isSystem && !NON_ASSIGNABLE_SHARED_IDS.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissionCount: r.permissionCount,
    }))
}

export interface OrganizationRow {
  id: string
  name: string
  currency: string
  isBlocked: boolean
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  adminCount: number
  createdAt: string
  /** Roles de sistema asignables por roleId, con su resumen de permisos. */
  assignableRoles: {
    id: string
    name: string
    description: string | null
    permissionCount: number
  }[]
}

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      owner: { select: { fullName: true, email: true } },
      memberships: { select: { role: true } },
    },
  })
  return Promise.all(
    orgs.map(async (o) => ({
      id: o.id,
      name: o.name,
      currency: o.currency,
      isBlocked: o.isBlocked,
      ownerName: o.owner.fullName,
      ownerEmail: o.owner.email,
      memberCount: o.memberships.length,
      adminCount: o.memberships.filter((m) => m.role === "admin").length,
      createdAt: o.createdAt.toISOString(),
      assignableRoles: await assignableRolesFor(o.id),
    }))
  )
}

export interface CreateOrganizationInput {
  name: string
  currency?: string
  ownerName?: string
  ownerEmail: string
  ownerPassword: string
}

/**
 * Crea la iglesia + la cuenta del propietario (membresía owner) + su ficha de
 * creyente (jerarquía pastor) + perfil, apariencia y suscripción inicial, para
 * que arranque operativa.
 */
export async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationRow> {
  const name = input.name?.trim()
  if (!name) throw new Error("El nombre de la iglesia es obligatorio")

  const email = normalizeIdentifier(input.ownerEmail)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Correo del propietario inválido")
  }
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (!existingUser && (!input.ownerPassword || input.ownerPassword.length < 8)) {
    throw new Error("La contraseña debe tener al menos 8 caracteres")
  }
  const ownerName = input.ownerName?.trim() || email.split("@")[0]

  const owner =
    existingUser ??
    (await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.ownerPassword),
        fullName: ownerName,
        isActive: true,
      },
    }))

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { name, ownerId: owner.id, currency: input.currency?.trim() || "MXN" },
    })
    await tx.membership.upsert({
      where: { userId_organizationId: { userId: owner.id, organizationId: created.id } },
      update: { role: "owner", roleId: "system-owner" },
      create: { userId: owner.id, organizationId: created.id, role: "owner", roleId: "system-owner" },
    })
    await tx.companyProfile.create({ data: { organizationId: created.id, tradeName: name } })
    await tx.appSettings.create({ data: { organizationId: created.id } })
    const member = await tx.member.create({
      data: {
        organizationId: created.id,
        userId: owner.id,
        fullName: owner.fullName,
        email,
        hierarchy: "pastor",
        visionStage: "discipleship",
      },
    })
    await tx.memberStageLog.create({
      data: { organizationId: created.id, memberId: member.id, stage: "discipleship", note: "Alta del propietario" },
    })
    return created
  })

  const starterPlan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
  })
  if (starterPlan) {
    const periodEndsAt = new Date()
    periodEndsAt.setDate(periodEndsAt.getDate() + 30)
    await prisma.organizationSubscription.create({
      data: { organizationId: org.id, planId: starterPlan.id, status: "active", periodEndsAt },
    })
  }

  return {
    id: org.id,
    name: org.name,
    currency: org.currency,
    isBlocked: org.isBlocked,
    ownerName: owner.fullName,
    ownerEmail: owner.email,
    memberCount: 1,
    adminCount: 0,
    createdAt: org.createdAt.toISOString(),
    assignableRoles: [],
  }
}

export async function updateOrganization(
  id: string,
  input: { name?: string; currency?: string; isBlocked?: boolean; blockedReason?: string | null }
): Promise<{ ok: boolean }> {
  await prisma.organization.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.currency !== undefined ? { currency: input.currency.trim() } : {}),
      ...(input.isBlocked !== undefined
        ? { isBlocked: input.isBlocked, blockedReason: input.isBlocked ? (input.blockedReason?.trim() || "Acceso suspendido") : null }
        : {}),
    },
  })
  return { ok: true }
}

// ── Usuarios y membresías ────────────────────────────────────────────────────

export interface UserRow {
  id: string
  fullName: string
  email: string
  isActive: boolean
  isSuperadmin: boolean
  memberships: {
    membershipId: string
    organizationId: string
    organizationName: string
    role: string
    roleId: string | null
    roleName: string | null
  }[]
}

export async function listAllUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      isSuperadmin: true,
      memberships: {
        select: {
          id: true,
          organizationId: true,
          role: true,
          roleId: true,
          roleRef: { select: { name: true } },
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    isActive: u.isActive,
    isSuperadmin: u.isSuperadmin,
    memberships: u.memberships.map((m) => ({
      membershipId: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
      roleId: m.roleId ?? null,
      roleName: m.roleRef?.name ?? null,
    })),
  }))
}

export async function createUser(input: {
  email: string
  fullName: string
  password: string
}): Promise<{ id: string }> {
  const email = normalizeIdentifier(input.email)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido")
  if (!input.fullName?.trim()) throw new Error("El nombre es obligatorio")
  if (!input.password || input.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres")

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("Ya existe un usuario con ese correo")
  if (process.env.NODE_ENV === "production" && !mailConfigured()) {
    throw new Error("Configura el correo SMTP antes de crear una cuenta con acceso")
  }

  const created = await prisma.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      passwordHash: await hashPassword(input.password),
      isActive: true,
      activationRequired: mailConfigured(),
    },
    select: { id: true },
  })
  if (mailConfigured()) {
    try {
      await sendWelcomeLink(email, { fullName: input.fullName.trim() })
    } catch (error) {
      console.error("[settings/organizations] No se pudo enviar la invitación:", error)
      await prisma.user.delete({ where: { id: created.id } })
      throw new Error("No se pudo enviar el correo de acceso. Intenta de nuevo.")
    }
  }
  return created
}

export async function listOrgMembers(orgId: string) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      roleRef: { select: { name: true, isSystem: true } },
    },
  })
  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    role: m.role,
    roleId: m.roleId ?? null,
    roleName: m.roleRef?.name ?? null,
  }))
}

/**
 * Asigna un usuario a una iglesia (upsert). `role` es el nivel (OrgRole);
 * `roleId` opcional apunta a un rol concreto (de sistema o propio) y define el
 * nivel y los permisos.
 */
export async function assignUserToOrg(
  organizationId: string,
  userId: string,
  role?: string,
  roleId?: string | null
): Promise<{ ok: boolean }> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) throw new Error("Iglesia no encontrada")
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("Usuario no encontrado")

  let enumRole: $Enums.OrgRole
  let resolvedRoleId: string | null = null

  if (roleId) {
    const roleRecord = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, isSystem: true, organizationId: true, level: true },
    })
    if (!roleRecord) throw new Error("Rol no encontrado")
    // Un rol propio de otra iglesia no puede asignarse aquí.
    if (!roleAllowedInOrg(roleRecord, org.id)) throw new Error(ROLE_SCOPE_GATE_MESSAGE)
    resolvedRoleId = roleRecord.id
    enumRole = roleRecord.isSystem ? roleIdToEnum(roleRecord.id) : roleRecord.level
  } else {
    if (!role || !VALID_ROLES.includes(role as $Enums.OrgRole)) throw new Error("Rol inválido")
    enumRole = role as $Enums.OrgRole
  }

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role: enumRole, roleId: resolvedRoleId },
    create: { userId, organizationId, role: enumRole, roleId: resolvedRoleId },
  })
  return { ok: true }
}

export async function removeMembership(membershipId: string): Promise<{ ok: boolean }> {
  await prisma.membership.delete({ where: { id: membershipId } })
  return { ok: true }
}
