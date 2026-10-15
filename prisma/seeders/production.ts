import bcrypt from "bcryptjs"
import { prisma } from "../../src/lib/db/client"
import { PERMISSIONS } from "../../src/lib/auth/permission-keys"
import { SYSTEM_ROLES } from "../../src/lib/auth/system-roles"
import { DEFAULT_PLAN_EXCLUSIONS, PLAN_PERMISSION_KEYS } from "../../src/lib/billing/plan-permissions"

// Seed de producción (base mínima, idempotente):
// - Superadmin de plataforma (solo si SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD existen).
// - Catálogo de permisos (fuente: src/lib/auth/permission-keys.ts).
// - Roles de sistema (fuente: src/lib/auth/system-roles.ts).
// - Menú dinámico del sistema (ids fijos).
// - Plan por defecto.
//
// Regla al agregar un permiso nuevo a un módulo que ya existía: respáldalo una sola
// vez a los roles propios y planes que ya tenían el permiso del que se desprende
// (patrón «el permiso aún no existía»), para no quitar acceso a nadie.

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME ?? "Superadmin"

// Menú dinámico predefinido (global, ids fijos para upsert).
type SystemMenuDef = {
  id: string
  parentId: string | null
  type: "section" | "item"
  label: string
  icon: string
  href?: string | null
  permissionKey?: string | null
  sortOrder: number
}

const RETIRED_MENU_IDS = ["menu-hogares", "menu-mis-hijos"]

export const SYSTEM_MENUS: SystemMenuDef[] = [
  { id: "menu-principal", parentId: null, type: "section", label: "Principal", icon: "LayoutDashboard", sortOrder: 1 },
  { id: "menu-panel", parentId: "menu-principal", type: "item", label: "Panel", icon: "LayoutDashboard", href: "/admin", sortOrder: 1 },
  { id: "menu-mi-espacio", parentId: "menu-principal", type: "item", label: "Mi espacio", icon: "HeartHandshake", href: "/mi", sortOrder: 2 },
  { id: "menu-calendario", parentId: "menu-principal", type: "item", label: "Calendario", icon: "CalendarDays", href: "/mi/calendario", sortOrder: 5 },
  { id: "menu-eventos", parentId: "menu-principal", type: "item", label: "Eventos", icon: "Ticket", href: "/mi/eventos", sortOrder: 5 },
  { id: "menu-donativos", parentId: "menu-principal", type: "item", label: "Donativos", icon: "HandCoins", href: "/mi/donativos", sortOrder: 6 },
  { id: "menu-noticias", parentId: "menu-principal", type: "item", label: "Noticias", icon: "Newspaper", href: "/mi/contenido", sortOrder: 7 },
  { id: "menu-transmisiones", parentId: "menu-principal", type: "item", label: "Transmisiones", icon: "Tv", href: "/mi/transmisiones", sortOrder: 8 },
  { id: "menu-mi-familia", parentId: "menu-principal", type: "item", label: "Mi familia", icon: "Users", href: "/mi/familia", sortOrder: 9 },
  { id: "menu-oracion", parentId: "menu-principal", type: "item", label: "Oración", icon: "HandHeart", href: "/mi/oracion", sortOrder: 9 },
  { id: "menu-mi-perfil", parentId: "menu-principal", type: "item", label: "Mi perfil", icon: "UserRound", href: "/mi/perfil", sortOrder: 9 },
  { id: "menu-reuniones", parentId: "menu-principal", type: "item", label: "Reuniones", icon: "CalendarDays", href: "/mi/reuniones", sortOrder: 4 },
  { id: "menu-notificaciones", parentId: "menu-principal", type: "item", label: "Notificaciones", icon: "BellRing", href: "/mi/notificaciones", sortOrder: 3 },

  { id: "menu-personas", parentId: null, type: "section", label: "Personas", icon: "Users", sortOrder: 2 },
  { id: "menu-creyentes", parentId: "menu-personas", type: "item", label: "Creyentes", icon: "Users", href: "/admin/members", permissionKey: "members.view", sortOrder: 1 },
  { id: "menu-familias", parentId: "menu-personas", type: "item", label: "Familias", icon: "Users", href: "/admin/families", permissionKey: "members.manage", sortOrder: 4 },
  { id: "menu-conexion", parentId: "menu-personas", type: "item", label: "Conexión y oración", icon: "Inbox", href: "/admin/connect", permissionKey: "members.manage", sortOrder: 3 },
  { id: "menu-empleados", parentId: "menu-personas", type: "item", label: "Empleados", icon: "UserCog", href: "/admin/employees", permissionKey: "employees.view", sortOrder: 2 },
  { id: "menu-puestos", parentId: "menu-personas", type: "item", label: "Puestos", icon: "Briefcase", href: "/admin/positions", permissionKey: "employees.view", sortOrder: 3 },

  { id: "menu-servicio", parentId: null, type: "section", label: "Servicio", icon: "HandHeart", sortOrder: 3 },
  { id: "menu-mis-ministerios", parentId: "menu-servicio", type: "item", label: "Mis ministerios", icon: "HeartHandshake", href: "/mi/ministerios", sortOrder: 1 },
  { id: "menu-mi-escuela", parentId: "menu-servicio", type: "item", label: "Mi escuela", icon: "GraduationCap", href: "/mi/escuela", sortOrder: 2 },
  { id: "menu-ministerios", parentId: "menu-servicio", type: "item", label: "Ministerios", icon: "HandHeart", href: "/admin/ministries", permissionKey: "ministries.view", sortOrder: 4 },
  { id: "menu-organigrama", parentId: "menu-servicio", type: "item", label: "Organigrama", icon: "Network", href: "/mi/organigrama", sortOrder: 3 },
  { id: "menu-mis-celulas", parentId: "menu-servicio", type: "item", label: "Mi hogar de amor", icon: "Home", href: "/mi/celulas", sortOrder: 2 },
  { id: "menu-celulas", parentId: "menu-servicio", type: "item", label: "Células y redes", icon: "Network", href: "/admin/cells", permissionKey: "cells.view", sortOrder: 5 },

  { id: "menu-iglesia", parentId: null, type: "section", label: "Iglesia", icon: "Church", sortOrder: 4 },
  { id: "menu-finanzas", parentId: "menu-iglesia", type: "item", label: "Finanzas", icon: "Wallet", href: "/admin/finance", permissionKey: "finance.view", sortOrder: 5 },
  { id: "menu-nomina", parentId: "menu-iglesia", type: "item", label: "Nómina", icon: "HandCoins", href: "/admin/payroll", permissionKey: "payroll.manage", sortOrder: 5 },
  { id: "menu-vehiculos", parentId: "menu-iglesia", type: "item", label: "Vehículos", icon: "Car", href: "/admin/vehicles", permissionKey: "vehicles.view", sortOrder: 6 },
  { id: "menu-escuela-gestion", parentId: "menu-iglesia", type: "item", label: "Escuela ministerial", icon: "GraduationCap", href: "/admin/school", permissionKey: "school.view", sortOrder: 4 },
  { id: "menu-eventos-gestion", parentId: "menu-iglesia", type: "item", label: "Gestión de eventos", icon: "Ticket", href: "/admin/events", permissionKey: "events.view", sortOrder: 3 },
  { id: "menu-reuniones-asistencia", parentId: "menu-iglesia", type: "item", label: "Asistencia a reuniones", icon: "Mic2", href: "/admin/gatherings", permissionKey: "gatherings.view", sortOrder: 2 },
  { id: "menu-reportes", parentId: "menu-iglesia", type: "item", label: "Reportes", icon: "BarChart3", href: "/admin/reports", permissionKey: "reports.view", sortOrder: 8 },
  { id: "menu-contenido-gestion", parentId: "menu-iglesia", type: "item", label: "Contenido y transmisiones", icon: "Megaphone", href: "/admin/content", permissionKey: "content.manage", sortOrder: 7 },
  { id: "menu-sedes", parentId: "menu-iglesia", type: "item", label: "Sedes", icon: "Church", href: "/admin/locations", permissionKey: "locations.view", sortOrder: 1 },

  { id: "menu-ajustes", parentId: null, type: "section", label: "Ajustes", icon: "Settings", sortOrder: 5 },
  { id: "menu-apariencia", parentId: "menu-ajustes", type: "item", label: "Apariencia", icon: "Palette", href: "/admin/settings/appearance", permissionKey: "settings.manage", sortOrder: 1 },
  { id: "menu-empresa", parentId: "menu-ajustes", type: "item", label: "Iglesia", icon: "Building2", href: "/admin/settings/company", permissionKey: "settings.manage", sortOrder: 2 },
  { id: "menu-my-plan", parentId: "menu-ajustes", type: "item", label: "Mi plan", icon: "BadgeDollarSign", href: "/admin/settings/my-plan", permissionKey: "settings.manage", sortOrder: 3 },
  { id: "menu-usuarios", parentId: "menu-ajustes", type: "item", label: "Usuarios y permisos", icon: "ShieldCheck", href: "/admin/settings/users", permissionKey: "users.manage", sortOrder: 4 },

  // Plataforma: páginas exclusivas del superadministrador (todas las iglesias).
  { id: "menu-plataforma", parentId: null, type: "section", label: "Plataforma", icon: "ShieldCheck", sortOrder: 6 },
  { id: "menu-organizations", parentId: "menu-plataforma", type: "item", label: "Iglesias", icon: "Building2", href: "/admin/settings/organizations", permissionKey: "organizations.manage", sortOrder: 1 },
  { id: "menu-subscriptions", parentId: "menu-plataforma", type: "item", label: "Control de suscripciones", icon: "ShieldCheck", href: "/admin/settings/subscriptions", permissionKey: "organizations.manage", sortOrder: 2 },
  { id: "menu-plans", parentId: "menu-plataforma", type: "item", label: "Planes del sistema", icon: "BadgeDollarSign", href: "/admin/settings/plans", permissionKey: "organizations.manage", sortOrder: 3 },
  { id: "menu-menus", parentId: "menu-plataforma", type: "item", label: "Menú", icon: "Menu", href: "/admin/settings/menus", permissionKey: "organizations.manage", sortOrder: 4 },
]

const PLANS = [
  {
    name: "Completo",
    description: "Todos los módulos de la plataforma para una iglesia.",
    monthlyPrice: 0,
    includedLocations: 5,
    includedEmployees: 2000,
    extraLocationPrice: 0,
    extraEmployeePackSize: 500,
    extraEmployeePackPrice: 0,
    sortOrder: 10,
    features: ["Creyentes y personal", "Panel administrativo", "Espacio personal del creyente", "Reportes"],
  },
]

export async function seedProduction() {
  // Superadmin: solo con credenciales explícitas por entorno (nunca por defecto).
  if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD) {
    const now = new Date()
    await prisma.user.upsert({
      where: { email: SUPERADMIN_EMAIL },
      update: { isActive: true, isSuperadmin: true, activationRequired: false, emailVerified: now },
      create: {
        email: SUPERADMIN_EMAIL,
        passwordHash: await bcrypt.hash(SUPERADMIN_PASSWORD, 10),
        fullName: SUPERADMIN_NAME,
        isActive: true,
        isSuperadmin: true,
        activationRequired: false,
        emailVerified: now,
        legalAcceptedAt: now,
        legalVersion: "2026-10-12",
      },
    })
  } else {
    console.warn("ℹ️  SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD no definidos: no se crea superadmin.")
  }

  // Permisos. Los que aún no existían se incorporan una sola vez a los planes que ya
  // guardaron una lista (salvo los que el plan excluye por defecto): un módulo nuevo
  // no debe quedar bloqueado para quien ya tenía plan.
  const knownKeys = new Set((await prisma.permission.findMany({ select: { key: true } })).map((k) => k.key))
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, label: p.label },
      create: { key: p.key, module: p.module, action: p.action, label: p.label },
    })
  }

  const newKeys = PLAN_PERMISSION_KEYS.filter((k) => !knownKeys.has(k))
  if (newKeys.length > 0 && knownKeys.size > 0) {
    for (const plan of await prisma.subscriptionPlan.findMany({ select: { id: true, name: true, permissions: true } })) {
      if (!Array.isArray(plan.permissions)) continue
      const excluded = new Set<string>(DEFAULT_PLAN_EXCLUSIONS[plan.name] ?? [])
      const add = newKeys.filter((k) => !excluded.has(k))
      const current = plan.permissions.map(String)
      const next = [...new Set([...current, ...add])]
      if (next.length !== current.length) {
        await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { permissions: next } })
      }
    }
  }

  // Roles de sistema
  for (const def of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { id: def.id },
      update: { name: def.name, description: def.description, level: def.level, isSystem: true },
      create: { id: def.id, name: def.name, description: def.description, level: def.level, isSystem: true },
    })
    // Si el superadmin ya ajustó los permisos de este rol, se respetan.
    if (role.permissionsEdited) continue
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, organizationId: null } })
    if (def.permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: def.permissions.map((key) => ({ roleId: role.id, permissionKey: key, allowed: true })),
      })
    }
  }

  // Entradas retiradas por duplicar otra (hogares de amor = células; hijos viven en Mi familia).
  await prisma.menu.updateMany({ where: { id: { in: RETIRED_MENU_IDS } }, data: { isActive: false } })

  // Menú dinámico
  for (const m of SYSTEM_MENUS) {
    const data = {
      parentId: m.parentId,
      type: m.type,
      label: m.label,
      icon: m.icon,
      href: m.href ?? null,
      badge: null,
      badgeVariant: null,
      permissionKey: m.permissionKey ?? null,
      sortOrder: m.sortOrder,
      isActive: true,
    }
    await prisma.menu.upsert({ where: { id: m.id }, update: data, create: { id: m.id, ...data } })
  }

  // Planes
  for (const plan of PLANS) {
    const saved = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
      select: { id: true, permissions: true },
    })
    // Permisos incluidos por defecto; si el superadmin ya los ajustó, se respetan.
    if (saved.permissions === null) {
      const excluded = DEFAULT_PLAN_EXCLUSIONS[plan.name] ?? []
      await prisma.subscriptionPlan.update({
        where: { id: saved.id },
        data: { permissions: PLAN_PERMISSION_KEYS.filter((k) => !excluded.includes(k)) },
      })
    }
  }
}
