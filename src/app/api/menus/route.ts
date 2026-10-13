import { NextResponse } from "next/server";
import { getMenuTree, createMenu } from "@/lib/menus/server";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { menusReadGuard, menusAdminGuard, menusErrorResponse } from "./guard";

// FASE 14.5/14.6 — GET: árbol filtrado por permisos · POST: crear menú (admin).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await menusReadGuard();
  if ("response" in guard) return guard.response;

  try {
    const { session } = guard;
    const isAdmin = session.user.role === "superadmin" || session.user.role === "owner" || session.user.role === "admin";
    const permissions = (session.user.permissions ?? []) as PermissionKey[];
    const menu = await getMenuTree(permissions, isAdmin, session.user.role, (session.user.planDenied ?? []) as PermissionKey[]);
    return NextResponse.json({ ok: true, menu });
  } catch (err) {
    return menusErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const node = await createMenu(input);
    return NextResponse.json({ ok: true, menu: node });
  } catch (err) {
    return menusErrorResponse(err);
  }
}
