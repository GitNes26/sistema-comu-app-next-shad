import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateMembershipRole, setUserActive, removeMembership } from "@/lib/settings/server";
import { usersManageGuard, settingsErrorResponse } from "../../guard";

// Cambiar rol / estado de un miembro (PATCH) o quitarlo (DELETE).

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { membershipId } = await params;
  try {
    const body = await req.json();

    if (body.roleId) {
      await updateMembershipRole(membershipId, undefined, body.roleId, guard.organizationId);
    } else if (body.role) {
      await updateMembershipRole(membershipId, body.role, undefined, guard.organizationId);
    }
    if (typeof body.isActive === "boolean") {
      const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
      if (membership) await setUserActive(membership.userId, body.isActive);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const guard = await usersManageGuard();
  if ("response" in guard) return guard.response;

  const { membershipId } = await params;
  try {
    const result = await removeMembership(membershipId, guard.organizationId);
    return NextResponse.json(result);
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
