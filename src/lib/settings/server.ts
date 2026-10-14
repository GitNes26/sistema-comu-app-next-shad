import { isUniqueViolation, prisma } from "@/lib/db";
import type { $Enums, Prisma } from "@/generated/prisma/client";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isValidSlug, slugify } from "@/lib/connect/rules";
import { roleAllowedInOrg, roleIdToEnum, ROLE_SCOPE_GATE_MESSAGE } from "@/lib/settings/system-roles";

// Servidor de ajustes: iglesia, perfil, usuarios, roles e invitaciones.

const LEVELS: $Enums.OrgRole[] = ["owner", "admin", "leader", "servant", "believer"];
const SOCIAL_KEYS = ["facebook", "instagram", "youtube", "tiktok", "whatsapp", "spotify", "x"] as const;

// ── Iglesia ──────────────────────────────────────────────────────────────────

export interface CompanyProfileInput {
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  donationsEnabled?: boolean;
  donationBank?: string | null;
  donationHolder?: string | null;
  donationClabe?: string | null;
  donationAccount?: string | null;
  donationCard?: string | null;
  donationLink?: string | null;
  donationNote?: string | null;
  publicEnabled?: boolean;
  publicSlug?: string | null;
  tagline?: string | null;
  pastorName?: string | null;
  pastorMessage?: string | null;
  heroImageUrl?: string | null;
  mapUrl?: string | null;
}

export async function getCompanyProfile(organizationId: string) {
  const [profile, organization] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { organizationId } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ]);
  return (
    profile ?? {
      id: "",
      organizationId,
      legalName: null,
      tradeName: organization?.name ?? "",
      taxId: null,
      description: null,
      logoUrl: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      phone: null,
      email: null,
      website: null,
      socialLinks: {} as Prisma.JsonValue,
      donationsEnabled: false,
      donationBank: null,
      donationHolder: null,
      donationClabe: null,
      donationAccount: null,
      donationCard: null,
      donationLink: null,
      donationNote: null,
      publicEnabled: false,
      publicSlug: null,
      tagline: null,
      pastorName: null,
      pastorMessage: null,
      heroImageUrl: null,
      mapUrl: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }
  );
}

/** Solo se conservan redes conocidas y con valor. */
function cleanSocialLinks(value: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const v = value?.[key]?.trim();
    if (v) out[key] = v.slice(0, 300);
  }
  return out;
}

export async function upsertCompanyProfile(organizationId: string, input: CompanyProfileInput) {
  if (!input.tradeName?.trim()) {
    throw new Error("El nombre de la iglesia es obligatorio");
  }
  const { socialLinks, publicSlug, ...rest } = input;
  let slug: string | null | undefined = undefined;
  if (publicSlug !== undefined) {
    slug = publicSlug ? slugify(publicSlug) : null;
    if (slug && !isValidSlug(slug)) {
      throw new Error("La dirección pública debe tener de 3 a 40 letras minúsculas, números o guiones, y no puede ser una palabra reservada");
    }
    if (slug) {
      const taken = await prisma.companyProfile.findFirst({ where: { publicSlug: slug, NOT: { organizationId } }, select: { id: true } });
      if (taken) throw new Error("Esa dirección pública ya la usa otra iglesia; elige otra");
    }
  }
  if (rest.publicEnabled && !(slug ?? (await prisma.companyProfile.findUnique({ where: { organizationId }, select: { publicSlug: true } }))?.publicSlug)) {
    throw new Error("Para activar la página pública elige primero su dirección");
  }
  const data = {
    ...rest,
    ...(slug !== undefined ? { publicSlug: slug } : {}),
    tradeName: input.tradeName.trim(),
    ...(socialLinks !== undefined ? { socialLinks: cleanSocialLinks(socialLinks) } : {}),
  };
  const upsert = () =>
    prisma.companyProfile.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
  try {
    return await upsert();
  } catch (err) {
    // Upsert no atómico en MySQL: reintentar resuelve la carrera como update.
    if (!isUniqueViolation(err)) throw err;
    return upsert();
  }
}

// ── Perfil de usuario ───────────────────────────────────────────────────────

export interface ProfileInput {
  fullName?: string;
  phone?: string | null;
  email?: string;
  avatarUrl?: string | null;
}

export async function getMyProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true },
  });
}

export async function updateMyProfile(userId: string, input: ProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    select: { id: true, email: true, fullName: true, avatarUrl: true, phone: true },
  });
}

// ── Usuarios ────────────────────────────────────────────────────────────────

export interface OrgUserRow {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: string;
  roleId: string | null;
  isEmployee: boolean;
}

export async function listOrgUsers(organizationId: string): Promise<OrgUserRow[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, isActive: true } } },
    orderBy: { createdAt: "asc" },
  });

  const employeeUserIds = new Set(
    (
      await prisma.member.findMany({
        where: { organizationId, userId: { not: null }, employee: { isNot: null } },
        select: { userId: true },
      })
    ).map((m) => m.userId as string)
  );

  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    fullName: m.user.fullName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    isActive: m.user.isActive,
    role: m.role,
    roleId: m.roleId,
    isEmployee: employeeUserIds.has(m.user.id),
  }));
}

export async function updateMembershipRole(
  membershipId: string,
  role?: string,
  roleId?: string,
  callerOrganizationId?: string
): Promise<{ ok: boolean }> {
  // La membresía debe existir y pertenecer a la iglesia del llamador
  // (evita modificar miembros de otra iglesia con un id adivinado).
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { organizationId: true },
  });
  if (!membership) throw new Error("Membresía no encontrada");
  if (callerOrganizationId && membership.organizationId !== callerOrganizationId) {
    throw new Error("Membresía no encontrada");
  }

  const data: { role?: $Enums.OrgRole; roleId?: string | null } = {};
  if (roleId) {
    const roleRecord = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, isSystem: true, organizationId: true, level: true },
    });
    if (!roleRecord) throw new Error("Rol no encontrado");
    // Un rol propio de otra iglesia no puede asignarse aquí.
    if (!roleAllowedInOrg(roleRecord, membership.organizationId)) {
      throw new Error(ROLE_SCOPE_GATE_MESSAGE);
    }
    data.roleId = roleId;
    // El nivel siempre acompaña al roleId para que el nivel grueso no quede viejo.
    data.role = roleRecord.isSystem ? roleIdToEnum(roleRecord.id) : roleRecord.level;
  } else if (role && LEVELS.includes(role as $Enums.OrgRole)) {
    data.role = role as $Enums.OrgRole;
    data.roleId = null;
  }
  if (Object.keys(data).length === 0) throw new Error("Rol inválido");
  await prisma.membership.update({ where: { id: membershipId }, data });
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<{ ok: boolean }> {
  // Cambiar el estado invalida las sesiones abiertas (authVersion).
  await prisma.user.update({ where: { id: userId }, data: { isActive, authVersion: { increment: 1 } } });
  return { ok: true };
}

export async function removeMembership(
  membershipId: string,
  callerOrganizationId?: string
): Promise<{ ok: boolean }> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { organizationId: true },
  });
  if (!membership) throw new Error("Membresía no encontrada");
  if (callerOrganizationId && membership.organizationId !== callerOrganizationId) {
    throw new Error("Membresía no encontrada");
  }
  await prisma.membership.delete({ where: { id: membershipId } });
  return { ok: true };
}

// ── Roles ───────────────────────────────────────────────────────────────────

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string | null;
  /** Nivel de acceso que recibe quien tenga este rol. */
  level: $Enums.OrgRole;
  permissionCount: number;
}

export async function listRoles(organizationId: string): Promise<RoleRow[]> {
  // Roles visibles: los propios de la iglesia + los de sistema.
  const roles = await prisma.role.findMany({
    where: { OR: [{ organizationId }, { isSystem: true }] },
    include: { _count: { select: { permissions: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    organizationId: r.organizationId,
    level: r.level,
    permissionCount: r._count.permissions,
  }));
}

async function assertManageableRole(roleId: string, organizationId: string, isSuperadmin: boolean, allowSystemRead = false) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isSystem: true, organizationId: true },
  });
  if (
    !role ||
    (role.organizationId !== organizationId &&
      !(isSuperadmin && role.organizationId === null) &&
      !(allowSystemRead && role.isSystem))
  )
    throw new Error("Rol no disponible en esta iglesia");
  if (!isSuperadmin && ["system-admin", "system-superadmin"].includes(role.id)) throw new Error("Rol no disponible");
  // Solo el superadmin modifica los permisos de un rol de sistema (afecta a todas las iglesias).
  if (role.isSystem && !allowSystemRead && !isSuperadmin) throw new Error("Los roles del sistema solo los modifica el superadmin");
  if (role.isSystem && !allowSystemRead && role.id === "system-superadmin") throw new Error("El rol superadmin conserva siempre acceso total");
  return role;
}

export async function getRolePermissions(roleId: string, organizationId: string, isSuperadmin: boolean): Promise<string[]> {
  await assertManageableRole(roleId, organizationId, isSuperadmin, true);
  const rps = await prisma.rolePermission.findMany({
    where: { roleId, organizationId: null },
    select: { permissionKey: true },
  });
  return rps.map((rp) => rp.permissionKey);
}

export async function setRolePermissions(roleId: string, keys: string[], organizationId: string, isSuperadmin: boolean): Promise<{ ok: boolean }> {
  const role = await assertManageableRole(roleId, organizationId, isSuperadmin);
  const valid = new Set(PERMISSIONS.map((p) => p.key));
  const filtered = keys.filter((k) => valid.has(k as never));
  if (!isSuperadmin && filtered.includes("organizations.manage")) throw new Error("Ese permiso está reservado al superadmin");
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId, organizationId: null } }),
    prisma.rolePermission.createMany({
      data: filtered.map((k) => ({ roleId, permissionKey: k, allowed: true })),
    }),
    // El seeder respeta lo que el superadmin dejó en los roles de sistema.
    ...(role.isSystem ? [prisma.role.update({ where: { id: roleId }, data: { permissionsEdited: true } })] : []),
  ]);
  return { ok: true };
}

export async function createRole(
  organizationId: string,
  input: { name: string; description?: string | null; copyRoleId?: string | null; global?: boolean; level?: string },
  isSuperadmin = false
): Promise<RoleRow> {
  if (!input.name?.trim()) throw new Error("El nombre es obligatorio");
  if (!isSuperadmin && ["admin", "superadmin"].includes(input.name.trim().toLowerCase())) throw new Error("Ese nombre está reservado para roles del sistema");
  if (input.global && !isSuperadmin) throw new Error("Solo el superadmin puede crear roles globales");
  if (input.copyRoleId) await assertManageableRole(input.copyRoleId, organizationId, isSuperadmin, true);
  // Un rol propio nunca recibe acceso total (owner/admin/superadmin): solo líder, servidor o creyente.
  const level: $Enums.OrgRole = (["leader", "servant", "believer"] as string[]).includes(input.level ?? "")
    ? (input.level as $Enums.OrgRole)
    : "servant";
  const scopeOrgId = input.global ? null : organizationId;
  const created = await prisma.role.create({
    data: {
      organizationId: scopeOrgId,
      name: input.name.trim(),
      description: input.description ?? null,
      level,
      isSystem: false,
    },
  });

  if (input.copyRoleId) {
    const source = await prisma.rolePermission.findMany({
      where: { roleId: input.copyRoleId, organizationId: null },
      select: { permissionKey: true },
    });
    if (source.length) {
      await prisma.rolePermission.createMany({
        data: source
          .filter((s) => isSuperadmin || s.permissionKey !== "organizations.manage")
          .map((s) => ({ roleId: created.id, permissionKey: s.permissionKey, allowed: true })),
      });
    }
  }

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    isSystem: created.isSystem,
    organizationId: created.organizationId,
    level: created.level,
    permissionCount: input.copyRoleId ? await prisma.rolePermission.count({ where: { roleId: created.id } }) : 0,
  };
}

export async function updateRole(
  roleId: string,
  input: { name?: string; description?: string | null; global?: boolean; level?: string },
  organizationId: string,
  isSuperadmin: boolean
): Promise<{ ok: boolean }> {
  const role = await assertManageableRole(roleId, organizationId, isSuperadmin);
  if (input.global !== undefined && !isSuperadmin) throw new Error("Solo el superadmin puede cambiar el alcance del rol");
  if (!isSuperadmin && input.name && ["admin", "superadmin"].includes(input.name.trim().toLowerCase())) throw new Error("Ese nombre está reservado para roles del sistema");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description;
  if (input.global !== undefined) data.organizationId = input.global ? null : undefined;
  if (input.level !== undefined && !role.isSystem && (["leader", "servant", "believer"] as string[]).includes(input.level)) {
    data.level = input.level;
    // Las membresías con este rol heredan el nuevo nivel.
    await prisma.membership.updateMany({ where: { roleId }, data: { role: input.level as $Enums.OrgRole } });
  }
  await prisma.role.update({ where: { id: roleId }, data });
  return { ok: true };
}

export async function deleteRole(roleId: string, organizationId: string, isSuperadmin: boolean): Promise<{ ok: boolean }> {
  await assertManageableRole(roleId, organizationId, isSuperadmin);
  const inUse = await prisma.membership.count({ where: { roleId } });
  if (inUse > 0) throw new Error("El rol está asignado a usuarios; reasígnalos antes de eliminarlo");
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.role.delete({ where: { id: roleId } });
  return { ok: true };
}

// ── Invitaciones ────────────────────────────────────────────────────────────

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  status: string;
  locationId: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

export async function listInvitations(organizationId: string): Promise<InvitationRow[]> {
  const rows = await prisma.userInvitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    roleId: i.roleId,
    status: i.status,
    locationId: i.locationId,
    createdAt: i.createdAt.toISOString(),
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
  }));
}

export async function createInvitation(
  organizationId: string,
  input: { email: string; role?: string; roleId?: string; locationId?: string | null }
): Promise<InvitationRow> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Correo inválido");
  }

  let roleEnum: $Enums.OrgRole = "servant";
  let roleId: string | null = null;
  if (input.roleId) {
    const roleRecord = await prisma.role.findUnique({
      where: { id: input.roleId },
      select: { id: true, isSystem: true, organizationId: true, level: true },
    });
    if (!roleRecord) throw new Error("Rol no encontrado");
    if (!roleAllowedInOrg(roleRecord, organizationId)) throw new Error(ROLE_SCOPE_GATE_MESSAGE);
    roleId = roleRecord.id;
    roleEnum = roleRecord.isSystem ? roleIdToEnum(roleRecord.id) : roleRecord.level;
  } else if (input.role && LEVELS.includes(input.role as $Enums.OrgRole)) {
    roleEnum = input.role as $Enums.OrgRole;
  }

  // No duplicar invitaciones pendientes.
  const existing = await prisma.userInvitation.findFirst({
    where: { organizationId, email, status: "pending" },
  });
  if (existing) throw new Error("Ya existe una invitación pendiente para este correo");

  const created = await prisma.userInvitation.create({
    data: { organizationId, email, role: roleEnum, roleId, locationId: input.locationId ?? null },
  });

  return {
    id: created.id,
    email: created.email,
    role: created.role,
    roleId: created.roleId,
    status: created.status,
    locationId: created.locationId,
    createdAt: created.createdAt.toISOString(),
    acceptedAt: null,
  };
}

export async function revokeInvitation(id: string, callerOrganizationId?: string): Promise<{ ok: boolean }> {
  const inv = await prisma.userInvitation.findUnique({ where: { id } });
  if (!inv || (callerOrganizationId && inv.organizationId !== callerOrganizationId)) {
    throw new Error("Invitación no encontrada");
  }
  await prisma.userInvitation.delete({ where: { id } });
  return { ok: true };
}
