// Catálogo de permisos (fuente única, sin dependencias de runtime).
// Lo usan el seeder de producción y los helpers de RBAC (cliente y servidor).
// Convención: `modulo.accion`, etiqueta en español. Al construir un módulo nuevo se
// agregan aquí sus permisos, se asignan en `SYSTEM_ROLES` y se respaldan una sola vez
// (ver prisma/seeders/production.ts).

export const PERMISSIONS = [
  { key: "members.view", module: "members", action: "view", label: "Ver creyentes" },
  { key: "members.manage", module: "members", action: "manage", label: "Registrar y editar creyentes, etapas y bautismos" },
  { key: "ministries.view", module: "ministries", action: "view", label: "Ver todos los ministerios" },
  { key: "ministries.manage", module: "ministries", action: "manage", label: "Crear/editar ministerios, gestionar miembros y decidir requisiciones" },
  { key: "finance.view", module: "finance", action: "view", label: "Ver ingresos, gastos y donativos" },
  { key: "finance.manage", module: "finance", action: "manage", label: "Registrar ingresos y gastos, y confirmar donativos" },
  { key: "payroll.manage", module: "payroll", action: "manage", label: "Gestionar la nómina" },
  { key: "vehicles.view", module: "vehicles", action: "view", label: "Ver los vehículos y su bitácora" },
  { key: "vehicles.manage", module: "vehicles", action: "manage", label: "Gestionar vehículos, mantenimiento, combustible y documentos" },
  { key: "content.manage", module: "content", action: "manage", label: "Publicar anuncios, devocionales y transmisiones en el portal" },
  { key: "school.view", module: "school", action: "view", label: "Ver la escuela ministerial: grupos, inscripciones y calificaciones" },
  { key: "school.manage", module: "school", action: "manage", label: "Configurar la escuela, libros, grupos, inscripciones y pagos" },
  { key: "events.view", module: "events", action: "view", label: "Ver todos los eventos, boletos y acomodo" },
  { key: "events.manage", module: "events", action: "manage", label: "Crear/editar eventos, áreas y planos, boletos y pagos" },
  { key: "events.checkin", module: "events", action: "checkin", label: "Registrar la entrada de boletos (QR)" },
  { key: "gatherings.view", module: "gatherings", action: "view", label: "Ver reuniones generales y su asistencia" },
  { key: "gatherings.manage", module: "gatherings", action: "manage", label: "Registrar reuniones, temas y asistencia; configurar horarios" },
  { key: "cells.view", module: "cells", action: "view", label: "Ver todas las células y redes" },
  { key: "cells.manage", module: "cells", action: "manage", label: "Crear/editar células y redes, integrantes y traspasos" },
  { key: "kids.authorize_exit", module: "kids", action: "authorize_exit", label: "Autorizar la salida de un niño de Comunidad Kids" },
  { key: "employees.view", module: "employees", action: "view", label: "Ver empleados y puestos" },
  { key: "employees.manage", module: "employees", action: "manage", label: "Crear/editar empleados y puestos" },
  { key: "locations.view", module: "locations", action: "view", label: "Ver sedes" },
  { key: "locations.manage", module: "locations", action: "manage", label: "Crear/editar sedes" },
  { key: "reports.view", module: "reports", action: "view", label: "Ver y exportar reportes (PDF y CSV) de los módulos a los que tiene acceso" },
  { key: "panel.stats", module: "panel", action: "stats", label: "Ver estadísticos del panel" },
  { key: "settings.manage", module: "settings", action: "manage", label: "Ajustes de la iglesia y apariencia" },
  { key: "users.manage", module: "users", action: "manage", label: "Administrar usuarios, roles y permisos" },
  { key: "organizations.manage", module: "organizations", action: "manage", label: "Gestionar iglesias y asignar administradores", superAdminOnly: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/** Nombre legible de cada módulo de permisos (editores de roles y planes). */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  members: "Creyentes",
  ministries: "Ministerios",
  finance: "Finanzas",
  payroll: "Nómina",
  vehicles: "Vehículos",
  content: "Contenido y transmisiones",
  reports: "Reportes",
  school: "Escuela ministerial",
  events: "Eventos",
  gatherings: "Reuniones generales",
  cells: "Células y redes",
  kids: "Comunidad Kids",
  employees: "Empleados y puestos",
  locations: "Sedes",
  panel: "Panel",
  settings: "Ajustes",
  users: "Usuarios y roles",
  organizations: "Iglesias",
};

/** Permisos agrupados por módulo, en el orden del catálogo. */
export function permissionsByModule() {
  const groups: Record<string, (typeof PERMISSIONS)[number][]> = {};
  for (const p of PERMISSIONS) (groups[p.module] ??= []).push(p);
  return groups;
}
