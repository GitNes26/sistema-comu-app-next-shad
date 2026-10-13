import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificationsGuard, visibleTo } from "./guard";

// Centro de notificaciones: listado paginado.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await notificationsGuard();
  if (guard instanceof NextResponse) return guard;
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? 40);
  const pageSize = Math.min(200, Math.max(1, pageSizeRaw || 40));
  const filter = searchParams.get("filter");

  const where: Record<string, unknown> = { organizationId: guard.organizationId, ...visibleTo(guard) };
  if (filter === "unread") where.readAt = null;

  try {
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      rows: rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        severity: n.severity,
        title: n.title,
        body: n.body,
        link: n.link,
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("[notifications]", err);
    return NextResponse.json({ ok: false, error: "Error al cargar notificaciones" }, { status: 500 });
  }
}
