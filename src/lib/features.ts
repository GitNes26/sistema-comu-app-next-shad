// Banderas de funcionalidad (feature flags).
// Fuente única de qué módulos existen y a qué ruta del menú corresponden. Hoy todas
// las iglesias tienen todos los módulos construidos; el control fino por iglesia
// se hace con el plan (permisos incluidos). Si un módulo necesita apagarse por
// iglesia, se agrega aquí un campo de perfil y se filtra en `isFeatureEnabled`.

export type FeatureKey =
  | "members"
  | "ministries"
  | "cells"
  | "gatherings"
  | "events"
  | "school"
  | "content"
  | "finance"
  | "vehicles"
  | "employees"
  | "locations"
  | "notifications"
  | "settings"
  | "reports"

export interface FeatureFlag {
  label: string
  description?: string
}

export const FEATURE_FLAGS: Record<FeatureKey, FeatureFlag> = {
  members: { label: "Creyentes" },
  ministries: { label: "Ministerios" },
  cells: { label: "Células y redes" },
  gatherings: { label: "Reuniones generales" },
  events: { label: "Eventos" },
  school: { label: "Escuela ministerial" },
  content: { label: "Contenido y transmisiones" },
  finance: { label: "Finanzas" },
  vehicles: { label: "Vehículos" },
  employees: { label: "Empleados y puestos" },
  locations: { label: "Sedes" },
  notifications: { label: "Notificaciones" },
  settings: { label: "Ajustes" },
  reports: { label: "Reportes" },
}

/** ¿Esta funcionalidad está activa? (hoy todas lo están en toda iglesia). */
export function isFeatureEnabled(feature: FeatureKey): boolean {
  return feature in FEATURE_FLAGS
}

/** Funcionalidades habilitadas. */
export function enabledFeatures(): FeatureKey[] {
  return Object.keys(FEATURE_FLAGS) as FeatureKey[]
}

/** Ruta del menú → funcionalidad (para filtrar ítems de navegación). */
export const NAV_HREF_TO_FEATURE: Record<string, FeatureKey> = {
  "/admin/members": "members",
  "/admin/ministries": "ministries",
  "/admin/cells": "cells",
  "/admin/gatherings": "gatherings",
  "/admin/events": "events",
  "/admin/school": "school",
  "/admin/content": "content",
  "/admin/finance": "finance",
  "/admin/vehicles": "vehicles",
  "/admin/employees": "employees",
  "/admin/positions": "employees",
  "/admin/locations": "locations",
  "/admin/notifications": "notifications",
  "/admin/reports": "reports",
  "/admin/settings": "settings",
}
