import type { $Enums } from "@/generated/prisma/client"
import { SYSTEM_ROLES } from "@/lib/auth/system-roles"

// Helpers compartidos de roles de sistema entre el flujo del superadmin
// (asignación de iglesias) y el gestor de usuarios de cada iglesia.

/** Nivel (OrgRole) que corresponde a un rol de sistema. */
export function roleIdToEnum(roleId: string): $Enums.OrgRole {
  return SYSTEM_ROLES.find((r) => r.id === roleId)?.level ?? "servant"
}

/** Info mínima de un rol para la compuerta de asignación. */
export type RoleScopeInfo = {
  isSystem: boolean
  /** Iglesia dueña de un rol propio (null = global / rol de sistema). */
  organizationId: string | null
}

/**
 * Compuerta de asignación (siempre activa, no solo visual):
 * - Rol de sistema: se puede asignar en cualquier iglesia.
 * - Rol propio: solo dentro de su propia iglesia.
 */
export function roleAllowedInOrg(role: RoleScopeInfo, membershipOrgId: string): boolean {
  if (role.isSystem) return true
  return role.organizationId !== null && role.organizationId === membershipOrgId
}

/** Mensaje consistente de la compuerta para los diálogos de usuarios. */
export const ROLE_SCOPE_GATE_MESSAGE = "Este rol pertenece a otra iglesia"
