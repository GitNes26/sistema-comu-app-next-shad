import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId, isSuperadminSession } from "@/lib/auth/org-context";
import type { Session } from "next-auth";

// Guard de rutas de ajustes.

type GuardResult = { session: Session; organizationId: string } | { response: NextResponse };

/** Sesión de app (no portal) con organización (usa activeOrganizationId). */
export async function settingsSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session, organizationId };
}

/** Requiere `settings.manage` (iglesia, lealtad, supervisor, apariencia). */
export async function settingsManageGuard(): Promise<GuardResult> {
  const g = await settingsSession();
  if ("response" in g) return g;
  if (!hasPermission(g.session, "settings.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return g;
}

/** Requiere `users.manage` (usuarios, roles, invitaciones). */
export async function usersManageGuard(): Promise<GuardResult> {
  const g = await settingsSession();
  if ("response" in g) return g;
  if (!hasPermission(g.session, "users.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return g;
}

/** Exclusivo del superAdmin (organizaciones y asignación de admins). */
export async function superadminGuard(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  if (!isSuperadminSession(session)) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session };
}

export function settingsErrorResponse(err: unknown): NextResponse {
  console.error("[settings]", err);
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
    { status: 500 }
  );
}