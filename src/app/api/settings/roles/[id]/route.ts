import { NextResponse } from "next/server";
import { getRolePermissions, updateRole, deleteRole } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../../guard";

// FASE 14.x/15.4 — Rol: permisos (GET), editar (PATCH), eliminar (DELETE).

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const permissions = await getRolePermissions(id, guard.organizationId, guard.session.user.role === "superadmin");
    return NextResponse.json({ ok: true, permissions });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const input = await req.json();
    const result = await updateRole(id, input, guard.organizationId, guard.session.user.role === "superadmin");
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const result = await deleteRole(id, guard.organizationId, guard.session.user.role === "superadmin");
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
