import webPush from "web-push";
import { prisma } from "@/lib/db";

// Configurar VAPID keys solo si están disponibles
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
// web-push exige un «mailto:» o una URL https como remitente.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@comu-app.local";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  sound?: string;
  data?: Record<string, unknown>;
}

/**
 * Envía una notificación push a todos los dispositivos de un usuario.
 * Si una suscripción falla (expirada/revocada), la elimina automáticamente.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    // VAPID keys no configuradas — silently skip
    return 0;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) return 0;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "comu-app",
    sound: payload.sound || "order-received",
    url: payload.url || "/",
    data: payload.data,
  });

  let sent = 0;
  const toDelete: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          { TTL: 86400 } // 24 hours
        );
        return sub.id;
      } catch (err: unknown) {
        // Error 404/410 = suscripción expirada o revocada
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          toDelete.push(sub.id);
        }
        return null;
      }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent++;
  }

  // Limpiar suscripciones expiradas
  if (toDelete.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  return sent;
}

/**
 * Envía notificación push a todos los usuarios de una organización.
 * Útil para promociones, publicaciones, etc.
 */
export async function sendPushToOrganization(
  organizationId: string,
  payload: PushPayload,
  excludeUserId?: string
): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const userIds = await prisma.pushSubscription.findMany({
    where: {
      organizationId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  let total = 0;
  for (const { userId } of userIds) {
    total += await sendPushToUser(userId, payload);
  }
  return total;
}
