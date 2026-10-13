import { NextResponse } from "next/server";
import { removeMembership } from "@/lib/settings/organizations";
import { superadminGuard, settingsErrorResponse } from "../../../../guard";

// Quitar a un usuario de una organización (DELETE). Exclusivo superAdmin.

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  const { membershipId } = await params;
  try {
    const result = await removeMembership(membershipId);
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}