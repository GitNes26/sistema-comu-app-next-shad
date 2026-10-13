import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys"

// Qué permisos incluye cada plan (sin dependencias de runtime: lo usan la
// sesión, el editor de planes y el de roles).
//
// SubscriptionPlan.permissions guarda la lista de permisos incluidos. Si es
// null el plan no restringe nada. Lo que el plan no incluye queda fuera para
// TODOS en la iglesia (propietario incluido): los roles solo pueden repartir
// lo que el plan permite.

/** Permisos que un plan puede incluir (los exclusivos del superAdmin no). */
export const PLAN_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.filter((p) => !("superAdminOnly" in p && p.superAdminOnly)).map((p) => p.key)

/** Permisos que el plan NO incluye (vacío si el plan no restringe). */
export function planDeniedKeys(planPermissions: unknown): PermissionKey[] {
  if (!Array.isArray(planPermissions)) return []
  const allowed = new Set(planPermissions.map(String))
  return PLAN_PERMISSION_KEYS.filter((k) => !allowed.has(k))
}

/** Normaliza la lista que llega del editor de planes. */
export function sanitizePlanPermissions(value: unknown): PermissionKey[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  const valid = new Set<string>(PLAN_PERMISSION_KEYS)
  return [...new Set(value.map(String))].filter((k): k is PermissionKey => valid.has(k))
}

/** Módulos que cada plan por defecto NO incluye (el seeder parte de aquí). */
export const DEFAULT_PLAN_EXCLUSIONS: Record<string, PermissionKey[]> = {
  Completo: [],
}

/**
 * Pantallas que pertenecen a un área del plan. Si el plan excluye TODOS los
 * permisos listados, la pantalla se oculta del menú y se bloquea.
 */
const PLAN_AREAS: [string, PermissionKey[]][] = [
  ["/admin/locations", ["locations.view", "locations.manage"]],
]

/** ¿La ruta cae en un área que el plan no incluye? */
export function isPlanBlockedPath(pathname: string, planDenied: readonly string[] | null | undefined): boolean {
  if (!planDenied?.length) return false
  const area = PLAN_AREAS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return !!area && area[1].every((k) => planDenied.includes(k))
}
