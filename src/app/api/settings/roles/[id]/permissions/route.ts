import { NextResponse } from "next/server";
import { setRolePermissions } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../../../guard";

// FASE 14.x/15.4 — Asignar permisos a un rol (matriz de permisos).

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const { permissions } = await req.json();
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ ok: false, error: "permissions inválido" }, { status: 400 });
    }
    const result = await setRolePermissions(id, permissions, guard.organizationId, guard.session.user.role === "superadmin");
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
