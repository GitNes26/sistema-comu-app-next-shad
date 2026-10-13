import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import type { Session } from "next-auth";

// Guard del módulo de menús.

type GuardResult = { session: Session } | { response: NextResponse };

export async function menusReadGuard(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.scope === "portal") {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session };
}

export async function menusAdminGuard(): Promise<GuardResult> {
  const g = await menusReadGuard();
  if ("response" in g) return g;
  // El menú es global (todas las iglesias): solo el superadministrador lo edita.
  if (g.session.user.role !== "superadmin" || !hasPermission(g.session, "organizations.manage")) {
    return { response: NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 }) };
  }
  return g;
}

export function menusErrorResponse(err: unknown): NextResponse {
  console.error("[menus]", err);
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
    { status: 500 }
  );
}
