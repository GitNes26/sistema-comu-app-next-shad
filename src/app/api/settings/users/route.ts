import { NextResponse } from "next/server";
import { listOrgUsers } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../guard";

// Listado de usuarios (miembros) de la organización.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const users = await listOrgUsers(guard.organizationId);
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
