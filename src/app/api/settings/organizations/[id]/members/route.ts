import { NextResponse } from "next/server";
import { assignUserToOrg, listOrgMembers } from "@/lib/settings/organizations";
import { superadminGuard, settingsErrorResponse } from "../../../guard";

// Miembros de una organización (GET) y asignar usuario (POST).
// Exclusivo del superAdmin.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const members = await listOrgMembers(id);
    return NextResponse.json({ ok: true, members });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const body = (await req.json()) as { userId: string; role?: string; roleId?: string | null };
    const result = await assignUserToOrg(id, body.userId, body.role, body.roleId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 400 }
    );
  }
}