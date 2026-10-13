import { NextResponse } from "next/server";
import { listInvitations, createInvitation } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../guard";

// Invitaciones: listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const invitations = await listInvitations(guard.organizationId);
    return NextResponse.json({ ok: true, invitations });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const invitation = await createInvitation(guard.organizationId, input);
    return NextResponse.json({ ok: true, invitation });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
