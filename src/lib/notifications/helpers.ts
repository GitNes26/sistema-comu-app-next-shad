import type { Notification } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { broadcastToOrg, broadcastToUser, type LiveNotificationPayload } from "@/lib/notifications/live";
import { sendPushToUser } from "@/lib/notifications/push";

// Persistencia + broadcast de notificaciones (stocks bajos y futuras).

const SEVERITY_ICON: Record<string, string> = {
  low_stock: "low-stock",
  warning: "low-stock",
  success: "sale-complete",
  order: "order-received",
  info: "notification",
};

export function notificationToPayload(n: Notification): LiveNotificationPayload {
  const meta = (n.metadata as Record<string, unknown> | null) ?? {};
  const sound = typeof meta.sound === "string" ? meta.sound : undefined;
  return {
    id: n.id,
    title: n.title,
    description: n.body ?? undefined,
    icon: n.kind ? SEVERITY_ICON[n.kind] : SEVERITY_ICON[n.severity],
    sound,
    href: n.link ?? undefined,
    read: Boolean(n.readAt),
    createdAt: n.createdAt.toISOString(),
  };
}

export interface PersistNotificationInput {
  organizationId: string;
  locationId?: string | null;
  userId?: string | null;
  recipientUserId?: string | null;
  /** Empleado vinculado al movimiento/evento que origina la notificación (11.7). */
  employeeId?: string | null;
  kind: string;
  title: string;
  body?: string;
  severity?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Si se provee un id de inventario, no duplica alertas activas para ese ítem. */
  dedupeInventoryId?: string;
}

export async function persistNotification(input: PersistNotificationInput) {
  if (input.dedupeInventoryId) {
    const latest = await prisma.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        kind: input.kind,
        readAt: null,
      },
      select: { id: true, metadata: true },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const meta = (latest.metadata as Record<string, unknown> | null) ?? {};
      if (meta.inventoryId === input.dedupeInventoryId) return null;
    }
  }

  const created = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "info",
      link: input.link ?? null,
      metadata: (input.metadata ?? {}) as object,
    },
  });

  if (input.recipientUserId) broadcastToUser(input.organizationId, input.recipientUserId, notificationToPayload(created));
  else broadcastToOrg(input.organizationId, notificationToPayload(created));

  // Enviar Web Push si la notificación tiene un userId (cliente portal)
  if (input.recipientUserId || input.userId) {
    const url = input.link || "/";
    const meta = (input.metadata ?? {}) as Record<string, unknown>;
    sendPushToUser(input.recipientUserId ?? input.userId!, {
      title: input.title,
      body: input.body ?? "",
      url,
      tag: `${input.kind}-${created.id}`,
      sound: typeof meta.sound === "string" ? meta.sound : "order-received",
    }).catch((err) => {
      console.error("[notifications] push delivery failed:", err);
    }); // fire-and-forget, no bloquear la respuesta
  }

  return created;
}
