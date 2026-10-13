import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { openOrgChannel, openUserChannel, sendItems } from "@/lib/notifications/live";
import { notificationToPayload } from "@/lib/notifications/helpers";

// SSE endpoint de notificaciones en tiempo real.
// Envía las no leídas al conectar y hace broadcast de las nuevas.

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // El creyente (portal) solo recibe lo dirigido a él, no los avisos generales.
      const isPortal = session.user.scope === "portal";
      const unregisterOrg = isPortal ? () => {} : openOrgChannel(organizationId, controller);
      const unregisterUser = openUserChannel(organizationId, session.user.id, controller);
      unregisterByController.set(controller, () => { unregisterOrg(); unregisterUser(); });

      // Enviar las pendientes que ya existen.
      prisma.notification
        .findMany({ where: { organizationId, ...(isPortal ? { recipientUserId: session.user.id } : { OR: [{ recipientUserId: null }, { recipientUserId: session.user.id }] }) }, orderBy: { createdAt: "desc" }, take: 40 })
        .then((recent) => sendItems(controller, recent.map(notificationToPayload)))
        .catch(() => {
          // Falla la carga inicial: el broadcast en vivo sigue funcionando.
        });

      // Heartbeat para mantener viva la conexión.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);
    },
    cancel(controller) {
      unregisterByController.get(controller)?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
