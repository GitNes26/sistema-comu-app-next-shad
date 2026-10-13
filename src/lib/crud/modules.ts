import type { PermissionKey } from "@/lib/auth/permission-keys";
import type { CrudModule } from "./types";
import { membersModule } from "./modules/members";
import { ministriesModule } from "./modules/ministries";
import { locationsModule } from "./modules/locations";
import { positionsModule } from "./modules/positions";
import { employeesModule } from "./modules/employees";

// Registro central de módulos CRUD del admin.
// El metadata de UI vive en components/admin/crud/crud-config.ts (lado cliente).
// Este registro viaja solo del lado servidor: API + páginas.

export interface CrudRegistryEntry {
  module: CrudModule<unknown>;
  title: string;
  description: string;
  permissionView: PermissionKey;
  permissionManage: PermissionKey;
  permissionDelete?: PermissionKey;
}

export const CRUD_MODULES: Record<string, CrudRegistryEntry> = {
  members: {
    module: membersModule as CrudModule<unknown>,
    title: "Creyentes",
    description: "Padrón de la iglesia.",
    permissionView: "members.view",
    permissionManage: "members.manage",
  },
  ministries: {
    module: ministriesModule as CrudModule<unknown>,
    title: "Ministerios",
    description: "Áreas de servicio de la iglesia.",
    permissionView: "ministries.view",
    permissionManage: "ministries.manage",
  },
  locations: {
    module: locationsModule as CrudModule<unknown>,
    title: "Sedes",
    description: "Sedes o congregaciones de la iglesia.",
    permissionView: "locations.view",
    permissionManage: "locations.manage",
  },
  positions: {
    module: positionsModule as CrudModule<unknown>,
    title: "Puestos",
    description: "Responsabilidades del personal.",
    permissionView: "employees.view",
    permissionManage: "employees.manage",
  },
  employees: {
    module: employeesModule as CrudModule<unknown>,
    title: "Empleados",
    description: "Personal que labora en la iglesia.",
    permissionView: "employees.view",
    permissionManage: "employees.manage",
  },
};

export const CRUD_KEYS = Object.keys(CRUD_MODULES);

export function getCrudEntry(key: string): CrudRegistryEntry | undefined {
  return CRUD_MODULES[key];
}
