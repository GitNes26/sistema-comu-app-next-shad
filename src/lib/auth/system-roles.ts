import type { $Enums } from "@/generated/prisma/client"
import { PERMISSIONS } from "@/lib/auth/permission-keys"

// Roles de sistema (organizationId = null): compartidos por todas las iglesias.
// `level` fija el nivel de acceso de la membresía; el nombre visible es el del rol.
// Los accesos a «lo propio» (mi ministerio, mi célula, mi libro, mis hijos) NO se
// reparten aquí: nacen de la relación (membresía, inscripción, tutela) y se validan
// en servidor por módulo.

// organizations.manage es exclusivo del superadmin.
const allKeys = PERMISSIONS.map((p) => p.key)
const appKeys = PERMISSIONS.filter((p) => p.key !== "organizations.manage").map((p) => p.key)

export type SystemRoleDef = {
  id: string
  name: string
  description: string
  level: $Enums.OrgRole
  permissions: readonly string[]
}

export const SYSTEM_ROLES: readonly SystemRoleDef[] = [
  { id: "system-superadmin", name: "Superadmin", description: "Plataforma: acceso total a todas las iglesias", level: "superadmin", permissions: allKeys },
  { id: "system-owner", name: "Propietario", description: "Pastor principal o dueño de la iglesia: acceso total", level: "owner", permissions: appKeys },
  { id: "system-admin", name: "Administrador de iglesia", description: "Acceso total en su iglesia", level: "admin", permissions: appKeys },
  {
    id: "system-pastor",
    name: "Pastor",
    description: "Creyentes, personal, sedes y estadísticos; sin administrar usuarios ni ajustes",
    level: "leader",
    permissions: ["reports.view", "members.view", "members.manage", "ministries.view", "ministries.manage", "cells.view", "cells.manage", "gatherings.view", "gatherings.manage", "events.view", "events.manage", "events.checkin", "school.view", "school.manage", "content.manage", "kids.authorize_exit", "finance.view", "vehicles.view", "employees.view", "locations.view", "panel.stats"],
  },
  {
    id: "system-all-rounder",
    name: "Administrativo completo",
    description: "Para equipos pequeños: opera creyentes, personal y sedes en un solo rol (sin usuarios ni ajustes)",
    level: "leader",
    permissions: ["reports.view", "members.view", "members.manage", "ministries.view", "ministries.manage", "cells.view", "cells.manage", "gatherings.view", "gatherings.manage", "events.view", "events.manage", "events.checkin", "school.view", "school.manage", "content.manage", "kids.authorize_exit", "finance.view", "finance.manage", "vehicles.view", "vehicles.manage", "employees.view", "employees.manage", "locations.view", "locations.manage", "panel.stats"],
  },
  {
    id: "system-secretary",
    name: "Secretaría",
    description: "Registro y consulta de creyentes",
    level: "servant",
    permissions: ["reports.view", "members.view", "members.manage", "ministries.view", "cells.view", "gatherings.view", "gatherings.manage", "events.view", "events.manage", "events.checkin", "school.view", "school.manage", "content.manage", "locations.view"],
  },
  {
    id: "system-treasurer",
    name: "Tesorero",
    description: "Ingresos, gastos, donativos, nómina y vehículos",
    level: "leader",
    permissions: ["reports.view", "members.view", "employees.view", "finance.view", "finance.manage", "payroll.manage", "vehicles.view", "vehicles.manage", "panel.stats"],
  },
  {
    id: "system-attendance",
    name: "Registro de asistencia",
    description: "Ujieres o secretaría que capturan la asistencia y el tema de las reuniones generales",
    level: "servant",
    permissions: ["gatherings.view", "gatherings.manage", "events.view", "events.checkin"],
  },
  {
    id: "system-kids-staff",
    name: "Personal de Kids",
    description: "Autoriza la salida de los niños de Comunidad Kids (se suma al acceso por ministerio)",
    level: "servant",
    permissions: ["kids.authorize_exit"],
  },
  { id: "system-network-leader", name: "Líder de red", description: "Gestiona las células de su red (alcance por relación)", level: "leader", permissions: [] },
  { id: "system-cell-leader", name: "Líder de célula", description: "Gestiona su célula (alcance por relación)", level: "leader", permissions: [] },
  { id: "system-ministry-leader", name: "Líder de ministerio", description: "Gestiona los ministerios que lidera (alcance por relación, no por permiso)", level: "leader", permissions: [] },
  { id: "system-teacher", name: "Maestro", description: "Imparte su libro o curso (alcance por relación)", level: "leader", permissions: [] },
  { id: "system-disciple", name: "Discípulo", description: "Seguimiento de los creyentes que discipula", level: "leader", permissions: [] },
  { id: "system-believer", name: "Creyente", description: "Su espacio personal: crecimiento, ministerios, escuela y contenido", level: "believer", permissions: [] },
]

/** Rol de sistema que se asigna por defecto a cada nivel (fallback de sesión). */
export function systemRoleIdForLevel(level: $Enums.OrgRole): string {
  switch (level) {
    case "superadmin": return "system-superadmin"
    case "owner": return "system-owner"
    case "admin": return "system-admin"
    case "leader": return "system-all-rounder"
    case "servant": return "system-secretary"
    case "believer": return "system-believer"
  }
}
