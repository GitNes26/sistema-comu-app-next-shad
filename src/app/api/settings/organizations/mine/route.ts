import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import { isSuperadminSession } from "@/lib/auth/org-context";

// Iglesias disponibles para la sesión actual.
// Superadmin: todas. App: solo las que tiene en membresía. (Lo usa el switcher).

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    if (isSuperadminSession(session)) {
      const orgs = await prisma.organization.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, currency: true },
      });
      return NextResponse.json({ ok: true, organizations: orgs });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        organization: { select: { id: true, name: true, currency: true } },
      },
    });
    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      currency: m.organization.currency,
      role: m.role,
    }));
    return NextResponse.json({ ok: true, organizations });
  } catch (err) {
    console.error("[organizations/mine]", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}