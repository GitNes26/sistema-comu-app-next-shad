import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  Baby,
  BadgeDollarSign,
  BellRing,
  Briefcase,
  CalendarDays,
  Building2,
  Car,
  Church,
  GraduationCap,
  HandCoins,
  HandHeart,
  HeartHandshake,
  LayoutDashboard,
  Home,
  Megaphone,
  Menu,
  BarChart3,
  Mic2,
  Newspaper,
  Network,
  Palette,
  Settings,
  Ticket,
  ShieldCheck,
  Tv,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { Session } from "next-auth";
import { hasPermission, isSuperadminOnlyPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import type { MenuNode } from "@/lib/menus/server";
import { resolveMenuIcon } from "@/lib/menu-icons";
import type { FeatureKey } from "@/lib/features";
import { NAV_HREF_TO_FEATURE, isFeatureEnabled } from "@/lib/features";

// Rutas + íconos + permisos definidos UNA sola vez.
// Sidebar, BottomBar y Drawer consumen esta especificación (fallback hardcoded)
// o el árbol dinámico de BD (useMenus → menuTreeToSections).

export interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  /** Feature flag key: si se define, el item solo se muestra si la funcionalidad está habilitada */
  feature?: FeatureKey;
  match?: RegExp;
  badge?: string;
  badgeVariant?: string;
  children?: NavItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/admin", label: "Panel", icon: LayoutDashboard },
      { href: "/mi", label: "Mi espacio", icon: HeartHandshake },
      { href: "/mi/reuniones", label: "Reuniones", icon: CalendarDays },
      { href: "/mi/donativos", label: "Donativos", icon: HandCoins },
      { href: "/mi/eventos", label: "Eventos", icon: Ticket },
      { href: "/mi/contenido", label: "Noticias", icon: Newspaper },
      { href: "/mi/transmisiones", label: "Transmisiones", icon: Tv },
      { href: "/mi/oracion", label: "Oración", icon: HandHeart },
      { href: "/mi/perfil", label: "Mi perfil", icon: UserRound },
      { href: "/mi/notificaciones", label: "Notificaciones", icon: BellRing },
    ],
  },
  {
    title: "Personas",
    items: [
      { href: "/admin/members", label: "Creyentes", icon: Users, permission: "members.view", feature: "members" },
      { href: "/admin/connect", label: "Conexión y oración", icon: Inbox, permission: "members.manage", feature: "members" },
      { href: "/admin/employees", label: "Empleados", icon: UserCog, permission: "employees.view", feature: "employees" },
      { href: "/admin/positions", label: "Puestos", icon: Briefcase, permission: "employees.view", feature: "employees" },
    ],
  },
  {
    title: "Servicio",
    items: [
      { href: "/mi/ministerios", label: "Mis ministerios", icon: HeartHandshake },
      { href: "/mi/celulas", label: "Mis células", icon: Home },
      { href: "/mi/escuela", label: "Mi escuela", icon: GraduationCap },
      { href: "/mi/hijos", label: "Mis hijos", icon: Baby },
      { href: "/admin/ministries", label: "Ministerios", icon: HandHeart, permission: "ministries.view", feature: "ministries" },
      { href: "/admin/cells", label: "Células y redes", icon: Network, permission: "cells.view", feature: "cells" },
    ],
  },
  {
    title: "Iglesia",
    items: [
      { href: "/admin/finance", label: "Finanzas", icon: Wallet, permission: "finance.view", feature: "finance" },
      { href: "/admin/payroll", label: "Nómina", icon: HandCoins, permission: "payroll.manage", feature: "finance" },
      { href: "/admin/vehicles", label: "Vehículos", icon: Car, permission: "vehicles.view", feature: "vehicles" },
      { href: "/admin/school", label: "Escuela ministerial", icon: GraduationCap, permission: "school.view", feature: "school" },
      { href: "/admin/events", label: "Gestión de eventos", icon: Ticket, permission: "events.view", feature: "events" },
      { href: "/admin/gatherings", label: "Asistencia a reuniones", icon: Mic2, permission: "gatherings.view", feature: "gatherings" },
      { href: "/admin/reports", label: "Reportes", icon: BarChart3, permission: "reports.view", feature: "reports" },
      { href: "/admin/content", label: "Contenido y transmisiones", icon: Megaphone, permission: "content.manage", feature: "content" },
      { href: "/admin/locations", label: "Sedes", icon: Church, permission: "locations.view", feature: "locations" },
    ],
  },
  {
    title: "Ajustes",
    items: [
      { href: "/admin/settings/appearance", label: "Apariencia", icon: Palette, permission: "settings.manage" },
      { href: "/admin/settings/company", label: "Iglesia", icon: Building2, permission: "settings.manage" },
      { href: "/admin/settings/my-plan", label: "Mi plan", icon: BadgeDollarSign, permission: "settings.manage" },
      { href: "/admin/settings/users", label: "Usuarios y permisos", icon: ShieldCheck, permission: "users.manage" },
    ],
  },
  {
    // Exclusivo del superadministrador: administra todas las iglesias.
    title: "Plataforma",
    items: [
      { href: "/admin/settings/organizations", label: "Iglesias", icon: Building2, permission: "organizations.manage" },
      { href: "/admin/settings/subscriptions", label: "Control de suscripciones", icon: ShieldCheck, permission: "organizations.manage" },
      { href: "/admin/settings/plans", label: "Planes del sistema", icon: BadgeDollarSign, permission: "organizations.manage" },
      { href: "/admin/settings/menus", label: "Menú", icon: Menu, permission: "organizations.manage" },
    ],
  },
];

/** Items principales para la BottomTabBar móvil. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/members", label: "Creyentes", icon: Users, permission: "members.view" },
  { href: "/mi", label: "Mi espacio", icon: HeartHandshake },
  { href: "/admin/settings", label: "Ajustes", icon: Settings, permission: "settings.manage" },
];

/** Perfil mínimo de sesión que usan los filtros de navegación en cliente. */
export interface NavUser {
  user?: {
    role?: string | null;
    permissions?: PermissionKey[];
    planDenied?: PermissionKey[];
  } | null;
}

function navUserHasPermission(navUser: NavUser | null, permission?: PermissionKey): boolean {
  if (!permission) return true;
  if (!navUser?.user) return false;
  const { role, permissions, planDenied } = navUser.user;
  if (isSuperadminOnlyPermission(permission)) return role === "superadmin";
  if (role !== "superadmin" && planDenied?.includes(permission)) return false;
  if (role === "superadmin" || role === "owner" || role === "admin") return true;
  return permissions?.includes(permission) ?? false;
}

function navUserCanSeeItem(navUser: NavUser | null, item: NavItem): boolean {
  if (item.href === "/admin/settings/menus" && navUser?.user?.role !== "superadmin") return false;
  return navUserHasPermission(navUser, item.permission);
}

/** Filtra secciones según permisos de la sesión (server-side). */
export function filterNavSections(session: Session | null, sections: NavSection[] = NAV_SECTIONS): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (item.href !== "/admin/settings/menus" || session?.user?.role === "superadmin") &&
          (!item.permission || hasPermission(session, item.permission))
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Igual que filterNavSections pero en cliente (los iconos viven del lado cliente). */
export function filterNavSectionsByUser(navUser: NavUser | null, sections: NavSection[] = NAV_SECTIONS): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => navUserCanSeeItem(navUser, item)) }))
    .filter((section) => section.items.length > 0);
}

// ── Funcionalidades habilitadas ───────────────────────────────────

function navItemHasFeature(item: NavItem): boolean {
  if (!item.feature) return true;
  return isFeatureEnabled(item.feature);
}

/** Filtra secciones de nav por las funcionalidades habilitadas (server-side). */
export function filterNavSectionsByFeature(sections: NavSection[] = NAV_SECTIONS): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter(navItemHasFeature) }))
    .filter((section) => section.items.length > 0);
}

/** Filtra por permisos + funcionalidades (cliente-side, iconos vivos). */
export function filterNavSectionsByUserAndFeature(
  navUser: NavUser | null,
  sections: NavSection[] = NAV_SECTIONS
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navUserCanSeeItem(navUser, item) && navItemHasFeature(item)),
    }))
    .filter((section) => section.items.length > 0);
}

/** ¿La ruta del menú pertenece a una funcionalidad habilitada? */
export function isNavHrefEnabled(href: string): boolean {
  const feature = NAV_HREF_TO_FEATURE[href];
  if (!feature) return true; // Sin mapeo = siempre visible
  return isFeatureEnabled(feature);
}

export function filterNavItems(navUser: NavUser | null, items: NavItem[]): NavItem[] {
  return items.filter((item) => navUserCanSeeItem(navUser, item));
}

/** ¿La ruta actual coincide con el item? (considera hijos) */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match.test(pathname);
  if (item.children?.length) {
    if (item.children.some((c) => isNavActive(c, pathname))) return true;
  }
  if (!item.href) return false;
  if (item.href === "/admin") return pathname === "/admin";
  if (pathname === item.href) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;
  // Gana la ruta registrada más específica.
  const href = item.href;
  for (const other of knownHrefs()) {
    if (other !== href && other.startsWith(`${href}/`) && (pathname === other || pathname.startsWith(`${other}/`))) return false;
  }
  return true;
}

// Rutas del menú conocidas (fallback + las que llegan de la BD).
const KNOWN_HREFS = new Set<string>();
function collectHrefs(items: NavItem[]) {
  for (const it of items) {
    if (it.href) KNOWN_HREFS.add(it.href);
    if (it.children?.length) collectHrefs(it.children);
  }
}
function knownHrefs() {
  if (KNOWN_HREFS.size === 0) for (const section of NAV_SECTIONS) collectHrefs(section.items);
  return KNOWN_HREFS;
}

/** Convierte el árbol de BD (MenuNode) a NavSection[] con íconos resueltos. */
function mapMenuItem(n: MenuNode): NavItem {
  if (n.href) knownHrefs().add(n.href);
  return {
    href: n.href ?? undefined,
    label: n.label,
    icon: resolveMenuIcon(n.icon),
    permission: (n.permissionKey as PermissionKey | null) ?? undefined,
    badge: n.badge ?? undefined,
    badgeVariant: n.badgeVariant ?? undefined,
    children: n.children.length ? n.children.map(mapMenuItem) : undefined,
  };
}

export function menuTreeToSections(tree: MenuNode[]): NavSection[] {
  return tree.map((n) => {
    if (n.type === "section") {
      return { title: n.label, items: n.children.map(mapMenuItem) };
    }
    return { items: [mapMenuItem(n)] };
  });
}

/** Aplana los items (con href) del árbol para la BottomTabBar. */
export function menuTreeToBottomItems(tree: MenuNode[], limit = 5): NavItem[] {
  const out: NavItem[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      if (n.type === "item" && n.href) {
        out.push(mapMenuItem(n));
        if (out.length >= limit) return;
      }
      walk(n.children);
      if (out.length >= limit) return;
    }
  };
  walk(tree);
  return out.slice(0, limit);
}
