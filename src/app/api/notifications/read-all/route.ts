import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificationsGuard, visibleTo } from "../guard";

// Marcar todas las notificaciones de la org como leídas (batch).

export async function POST() {
  const guard = await notificationsGuard();
  if (guard instanceof NextResponse) return guard;

  try {
    const { count } = await prisma.notification.updateMany({
      where: { organizationId: guard.organizationId, readAt: null, ...visibleTo(guard) },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, updated: count });
  } catch (err) {
    console.error("[notifications/read-all]", err);
    return NextResponse.json({ ok: false, error: "Error al marcar notificaciones" }, { status: 500 });
  }
}
