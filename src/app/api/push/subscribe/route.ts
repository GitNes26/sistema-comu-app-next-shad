import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";

/**
 * POST /api/push/subscribe
 * Guarda una suscripción Web Push del usuario (iglesia efectiva de la sesión).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.p256dh;
  const pushAuth = body?.auth;
  if (!endpoint || !p256dh || !pushAuth || endpoint.length > 512) {
    return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ error: "Sin iglesia activa" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: session.user.id, endpoint } },
    update: { p256dh, auth: pushAuth, userAgent, organizationId },
    create: { organizationId, userId: session.user.id, endpoint, p256dh, auth: pushAuth, userAgent },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/subscribe
 * Elimina una suscripción (o todas las del usuario al cerrar sesión).
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, ...(body.endpoint ? { endpoint: body.endpoint } : {}) },
  });

  return NextResponse.json({ ok: true });
}
