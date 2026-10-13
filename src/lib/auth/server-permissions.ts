import { prisma } from "@/lib/db";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys";
import { isFullAccessRole } from "@/lib/auth/permissions";
import { systemRoleIdForLevel } from "@/lib/auth/system-roles";
import type { $Enums } from "@/generated/prisma/client";

// Resolución de permisos y guard server-side.
// Híbrido: roles globales (organizationId=NULL) + roles por iglesia.

/**
 * Permisos efectivos de un rol.
 * 1. superadmin → todos los permisos
 * 2. owner/admin → full access (sin consultar BD)
 * 3. Si se provee roleId → consulta RolePermission del rol específico
 * 4. Fallback: consulta RolePermission del rol de sistema del nivel
 */
export async function permissionsForRole(
  role: string,
  roleId?: string | null,
  organizationId?: string | null
): Promise<PermissionKey[]> {
  if (role === "believer" && !roleId) return [];
  if (role === "superadmin") return PERMISSIONS.map((p) => p.key as PermissionKey);

  // Si se tiene un roleId explícito (rol propio o de sistema), usarlo
  if (roleId) {
    const rps = await prisma.rolePermission.findMany({
      where: {
        roleId,
        allowed: true,
        // Buscar permisos globales (organizationId=NULL) o de la iglesia
        OR: [
          { organizationId: null },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      select: { permissionKey: true },
    });
    return rps.map((rp) => rp.permissionKey as PermissionKey);
  }

  // Fallback: rol de sistema por defecto
  const systemRoleId = systemRoleIdForLevel(role as $Enums.OrgRole);
  const rps = await prisma.rolePermission.findMany({
    where: { roleId: systemRoleId, organizationId: null, allowed: true },
    select: { permissionKey: true },
  });
  return rps.map((rp) => rp.permissionKey as PermissionKey);
}

export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permiso requerido: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/** Lanza si la sesión no tiene el permiso. Para server actions / route handlers. */
export function assertPermission(
  session: { user?: { role?: string; permissions?: string[]; planDenied?: string[] } } | null,
  permission: PermissionKey
): void {
  if (!session?.user) throw new PermissionDeniedError(permission);
  const { role, permissions, planDenied } = session.user;
  if (role !== "superadmin" && planDenied?.includes(permission)) throw new PermissionDeniedError(permission);
  if (isFullAccessRole(role)) return;
  if (!permissions?.includes(permission)) throw new PermissionDeniedError(permission);
}
