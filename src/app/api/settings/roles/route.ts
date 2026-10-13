import { NextResponse } from "next/server";
import { listRoles, createRole } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../guard";
import { settingsSession } from "../guard";
import { hasPermission } from "@/lib/auth/permissions";

// FASE 14.x/15.4 — Roles: listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsSession();
  if ("response" in guard) return guard.response;
  if (!hasPermission(guard.session, "users.manage") && !hasPermission(guard.session, "employees.manage")) {
    return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  try {
    const actorRole = guard.session.user.role;
    const roles = (await listRoles(guard.organizationId)).filter((role) =>
      (actorRole === "superadmin" || !["system-admin", "system-superadmin"].includes(role.id)) &&
      (["superadmin", "owner"].includes(actorRole) || role.id !== "system-owner")
    );
    return NextResponse.json({ ok: true, roles });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const role = await createRole(guard.organizationId, input, guard.session.user.role === "superadmin");
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
