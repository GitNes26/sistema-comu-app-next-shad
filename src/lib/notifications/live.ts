// FASE 8.9/11 — Registro en memoria de canales SSE por organización (pub/sub).

type Controller = ReadableStreamDefaultController<Uint8Array>;

/** payload de notificación tal como lo espera el hook cliente. */
export interface LiveNotificationPayload {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  sound?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

// Singleton en globalThis (misma razón que lib/kds/live.ts en dev).
const globalForNotificationsLive = globalThis as unknown as {
  notificationChannels: Map<string, Set<Controller>> | undefined;
};
const channels =
  globalForNotificationsLive.notificationChannels ?? new Map<string, Set<Controller>>();
if (process.env.NODE_ENV !== "production")
  globalForNotificationsLive.notificationChannels = channels;

const encoder = new TextEncoder();

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export function openOrgChannel(organizationId: string, controller: Controller) {
  let set = channels.get(organizationId);
  if (!set) {
    set = new Set();
    channels.set(organizationId, set);
  }
  set.add(controller);
  return () => {
    set?.delete(controller);
    if (set?.size === 0) channels.delete(organizationId);
  };
}

export function openUserChannel(organizationId: string, userId: string, controller: Controller) {
  return openOrgChannel(`${organizationId}:${userId}`, controller);
}

export function broadcastToUser(organizationId: string, userId: string, payload: LiveNotificationPayload) {
  broadcastToOrg(`${organizationId}:${userId}`, payload);
}

export function sendItems(controller: Controller, items: LiveNotificationPayload[]) {
  controller.enqueue(okChunk({ items }));
}

export function broadcastToOrg(organizationId: string, payload: LiveNotificationPayload) {
  const set = channels.get(organizationId);
  if (!set || set.size === 0) return;
  const chunk = okChunk(payload);
  for (const ctrl of set) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      set.delete(ctrl);
    }
  }
}

export function broadcastItems(organizationId: string, items: LiveNotificationPayload[]) {
  const set = channels.get(organizationId);
  if (!set || set.size === 0) return;
  const chunk = okChunk({ items });
  for (const ctrl of set) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      set.delete(ctrl);
    }
  }
}

export function orgChannelCount(organizationId: string): number {
  return channels.get(organizationId)?.size ?? 0;
}
