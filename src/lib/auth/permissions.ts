import type { Session } from "next-auth";
import type { $Enums } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// Helpers RBAC seguros para cliente (solo leen la sesión).
// `superadmin` se identifica por scope/rol, no por correo. owner y admin tienen
// acceso total dentro de su iglesia; el resto depende de los permisos del rol.

export type AppRole = $Enums.OrgRole;
export type SessionRole = AppRole;

export const SYSTEM_ROLE_NAMES = ["superadmin", "owner", "admin", "leader", "servant", "believer"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/** Niveles cuya sesión es solo el espacio personal del creyente. */
const PORTAL_ROLES: SessionRole[] = ["believer"];

/** Clave de permiso reservada al superadmin (menú y página de iglesias). */
export const SUPERADMIN_ONLY_PERMISSION = "organizations.manage";

/** Roles con acceso total (pasan todas las verificaciones). */
export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === "superadmin" || role === "owner" || role === "admin";
}

/** ¿Es el permiso que solo ve el superadmin (organizations.manage)? */
export function isSuperadminOnlyPermission(permission: PermissionKey | string): boolean {
  return permission === SUPERADMIN_ONLY_PERMISSION;
}

/** ¿El usuario tiene el permiso? superadmin/owner/admin pasan siempre. */
export function hasPermission(
  session: Session | null,
  permission: PermissionKey
): boolean {
  if (!session?.user) return false;
  const { role, permissions, planDenied } = session.user;
  if (isSuperadminOnlyPermission(permission)) return role === "superadmin";
  // Lo que el plan contratado no incluye queda fuera para todos (propietario incluido).
  if (role !== "superadmin" && planDenied?.includes(permission)) return false;
  if (isFullAccessRole(role)) return true;
  return permissions?.includes(permission) ?? false;
}

/** ¿Es una sesión de creyente (solo su espacio personal)? */
export function isPortalSession(session: Session | null): boolean {
  return PORTAL_ROLES.includes((session?.user?.role ?? "") as SessionRole);
}
