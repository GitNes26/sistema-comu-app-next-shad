import { prisma } from "@/lib/db";
import { isPlanBlockedPath } from "@/lib/billing/plan-permissions";
import { isSuperadminOnlyPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 14.4/14.5 — Menú dinámico multinivel: CRUD + árbol filtrado por permisos.

export interface MenuNode {
  id: string;
  parentId: string | null;
  type: "section" | "item";
  label: string;
  icon: string | null;
  href: string | null;
  badge: string | null;
  badgeVariant: string | null;
  permissionKey: string | null;
  sortOrder: number;
  isActive: boolean;
  children: MenuNode[];
}

export interface MenuInput {
  type?: "section" | "item";
  label: string;
  icon?: string | null;
  href?: string | null;
  badge?: string | null;
  badgeVariant?: string | null;
  permissionKey?: string | null;
  sortOrder?: number;
  parentId?: string | null;
  isActive?: boolean;
}

interface MenuRow {
  id: string;
  parentId: string | null;
  type: string;
  label: string;
  icon: string | null;
  href: string | null;
  badge: string | null;
  badgeVariant: string | null;
  permissionKey: string | null;
  sortOrder: number;
  isActive: boolean;
}

function toNode(m: MenuRow): MenuNode {
  return {
    id: m.id,
    parentId: m.parentId,
    type: (m.type === "section" ? "section" : "item") as MenuNode["type"],
    label: m.label,
    icon: m.icon,
    href: m.href,
    badge: m.badge,
    badgeVariant: m.badgeVariant,
    permissionKey: m.permissionKey,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    children: [],
  };
}

const MENU_SELECT = {
  id: true,
  parentId: true,
  type: true,
  label: true,
  icon: true,
  href: true,
  badge: true,
  badgeVariant: true,
  permissionKey: true,
  sortOrder: true,
  isActive: true,
} as const;

/** ¿El usuario (con esos permisos) puede ver un nodo con esa clave? */
function canSee(
  permissionKey: string | null,
  permissions: PermissionKey[] | null,
  isAdmin: boolean,
  role: string | null,
  planDenied: PermissionKey[] = []
): boolean {
  if (!permissionKey) return true;
  if (isSuperadminOnlyPermission(permissionKey)) return role === "superadmin";
  if (role !== "superadmin" && planDenied.includes(permissionKey as PermissionKey)) return false;
  if (isAdmin) return true;
  return permissions?.includes(permissionKey as PermissionKey) ?? false;
}

function buildTree(nodes: MenuNode[]): MenuNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots: MenuNode[] = [];
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  const sort = (arr: MenuNode[]) => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Filtra el árbol conservando nodos visibles y padres con hijos visibles. */
function filterTree(nodes: MenuNode[], keep: (n: MenuNode) => boolean): MenuNode[] {
  const result: MenuNode[] = [];
  for (const n of nodes) {
    const children = filterTree(n.children, keep);
    // Una sección sin hijos visibles no se muestra (p. ej. "Plataforma" para no superadmin).
    const visible = n.type === "section" ? children.length > 0 : keep(n) || children.length > 0;
    if (visible) {
      result.push({ ...n, children });
    }
  }
  return result;
}

/**
 * Árbol de menú filtrado por permisos (14.5). Solo nodos activos.
 * `isAdmin` = superadmin/owner/admin (ven todo).
 */
export async function getMenuTree(
  permissions: PermissionKey[] | null,
  isAdmin: boolean,
  role?: string | null,
  planDenied: PermissionKey[] = []
): Promise<MenuNode[]> {
  const rows = await prisma.menu.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: MENU_SELECT,
  });
  const nodes = rows.map((r) => toNode(r as MenuRow));
  const keep = (n: MenuNode) =>
    (n.href !== "/admin/settings/menus" || role === "superadmin") &&
    (role === "superadmin" || !n.href || !isPlanBlockedPath(n.href, planDenied)) &&
    canSee(n.permissionKey, permissions, isAdmin, role ?? null, planDenied);
  return filterTree(buildTree(nodes), keep);
}

/** Lista plana de todos los menús (admin), ordenada para el editor. */
export async function listAllMenus(): Promise<MenuNode[]> {
  const rows = await prisma.menu.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: MENU_SELECT,
  });
  return rows.map((r) => toNode(r as MenuRow));
}

export async function createMenu(input: MenuInput): Promise<MenuNode> {
  if (!input.label?.trim()) throw new Error("El label es obligatorio");
  if (input.parentId) {
    const parent = await prisma.menu.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new Error("Menú padre no encontrado");
  }
  const created = await prisma.menu.create({
    data: {
      parentId: input.parentId ?? null,
      type: input.type === "section" ? "section" : "item",
      label: input.label.trim(),
      icon: input.icon ?? null,
      href: input.href ?? null,
      badge: input.badge ?? null,
      badgeVariant: input.badgeVariant ?? null,
      permissionKey: input.permissionKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
    select: MENU_SELECT,
  });
  return toNode(created as MenuRow);
}

export async function updateMenu(id: string, input: MenuInput): Promise<MenuNode> {
  if (input.parentId) {
    if (input.parentId === id) throw new Error("Un menú no puede ser su propio padre");
    const parent = await prisma.menu.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new Error("Menú padre no encontrado");
  }
  const updated = await prisma.menu.update({
    where: { id },
    data: {
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.type !== undefined ? { type: input.type === "section" ? "section" : "item" } : {}),
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.icon !== undefined ? { icon: input.icon ?? null } : {}),
      ...(input.href !== undefined ? { href: input.href ?? null } : {}),
      ...(input.badge !== undefined ? { badge: input.badge ?? null } : {}),
      ...(input.badgeVariant !== undefined ? { badgeVariant: input.badgeVariant ?? null } : {}),
      ...(input.permissionKey !== undefined ? { permissionKey: input.permissionKey ?? null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: MENU_SELECT,
  });
  return toNode(updated as MenuRow);
}

export async function deleteMenu(id: string): Promise<{ ok: boolean }> {
  await prisma.menu.delete({ where: { id } });
  return { ok: true };
}

export async function reorderMenus(
  items: { id: string; sortOrder: number; parentId: string | null }[]
): Promise<{ ok: boolean }> {
  await prisma.$transaction(
    items.map((i) =>
      prisma.menu.update({
        where: { id: i.id },
        data: { sortOrder: i.sortOrder, parentId: i.parentId },
      })
    )
  );
  return { ok: true };
}
