import { SYSTEM_ROLES } from "@/lib/auth/system-roles"

// Accesos rápidos de DESARROLLO: un botón por cada rol de sistema en el login, para probar la
// app como cada tipo de usuario. Solo existen mientras NODE_ENV sea «development»; en producción
// la lista llega vacía y no se renderiza nada. Los usuarios los crea el seeder de demostración.

export interface DevAccount {
  roleId: string
  label: string
  description: string
  email: string
}

/** Rol de sistema → correo del usuario de demostración (el superadmin no es de una iglesia demo). */
export const DEV_ACCOUNT_EMAILS: Record<string, string> = {
  "system-owner": "demo.owner@comuapp.test",
  "system-admin": "demo.admin@comuapp.test",
  "system-pastor": "demo.pastor@comuapp.test",
  "system-all-rounder": "demo.administrativo@comuapp.test",
  "system-secretary": "demo.secretaria@comuapp.test",
  "system-treasurer": "demo.tesorero@comuapp.test",
  "system-attendance": "demo.asistencia@comuapp.test",
  "system-kids-staff": "demo.kids@comuapp.test",
  "system-network-leader": "demo.red@comuapp.test",
  "system-cell-leader": "demo.celula@comuapp.test",
  "system-ministry-leader": "demo.ministerio@comuapp.test",
  "system-teacher": "demo.maestro@comuapp.test",
  "system-disciple": "demo.discipulo@comuapp.test",
  "system-believer": "demo.creyente@comuapp.test",
}

export const isDevLoginEnabled = () => process.env.NODE_ENV === "development"

/** Cuentas de demostración para el login; vacío fuera de desarrollo. */
export function devAccounts(): DevAccount[] {
  if (!isDevLoginEnabled()) return []
  return SYSTEM_ROLES.flatMap((r) => {
    const email = DEV_ACCOUNT_EMAILS[r.id]
    return email ? [{ roleId: r.id, label: r.name, description: r.description, email }] : []
  })
}

/** Contraseña común de la demo (la misma que usa el seeder); solo se entrega en desarrollo. */
export function devPassword(): string | null {
  return isDevLoginEnabled() ? (process.env.DEMO_PASSWORD ?? "Demo123") : null
}
