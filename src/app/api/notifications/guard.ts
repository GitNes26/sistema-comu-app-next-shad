import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";

// Guard del módulo de notificaciones. El personal ve lo dirigido a él y los avisos
// generales de la iglesia; el creyente (portal) solo ve lo dirigido a él.

export type NotificationsGuard = { organizationId: string; userId: string; isPortal: boolean };

export async function notificationsGuard(): Promise<NotificationsGuard | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }
  return { organizationId, userId: session.user.id, isPortal: session.user.scope === "portal" };
}

/** Filtro de las notificaciones que la persona puede ver. */
export function visibleTo(g: NotificationsGuard) {
  return g.isPortal ? { recipientUserId: g.userId } : { OR: [{ recipientUserId: null }, { recipientUserId: g.userId }] };
}
