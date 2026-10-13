import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificationsGuard, visibleTo } from "../guard";

// Marcar una notificación como leída (PATCH).

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await notificationsGuard();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const body = (await req.json().catch(() => null)) as { read?: boolean } | null;
    const read = body?.read === false ? false : true;
    await prisma.notification.updateMany({
      where: { id, organizationId: guard.organizationId, ...visibleTo(guard) },
      data: { readAt: read ? new Date() : null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications/[id]]", err);
    return NextResponse.json({ ok: false, error: "Error al marcar la notificación" }, { status: 500 });
  }
}
