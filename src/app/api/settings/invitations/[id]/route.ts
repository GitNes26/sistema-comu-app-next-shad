import { NextResponse } from "next/server";
import { revokeInvitation } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../../guard";

// Revocar invitación.

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const result = await revokeInvitation(id);
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
