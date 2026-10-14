"use client";

import * as React from "react";
import { useNotificationStore, type AppNotification } from "@/stores/notifications-store";
import { useSseStore } from "@/stores/sse-store";
import { playSound } from "@/lib/sounds";
import { notify } from "@/lib/notify";

// Cliente SSE para notificaciones en tiempo real.
// Conecta a `/api/notifications/stream`; reintenta con backoff. Al recibir una
// notificación individual reproduce su sonido (11.5) y muestra toast (11.4).

const MAX_RETRIES = 6;

const SOUND_BY_ICON: Record<string, Parameters<typeof playSound>[0]> = {
  "sale-complete": "sale-complete",
  "low-stock": "low-stock",
  "order-received": "order-received",
  "order-ready": "order-ready",
  notification: "notification",
  success: "sale-complete",
};

export function useNotificationSse(enabled = true, id = "notifications") {
  // El estado también alimenta al badge "En vivo" compartido. La campana y el
  // centro de notificaciones pueden montar el hook a la vez: cada montaje
  // registra su propio id para que el unregister no pise al otro.
  const registerSse = useSseStore((s) => s.register);
  const unregisterSse = useSseStore((s) => s.unregister);
  const setSseStatus = useSseStore((s) => s.setStatus);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const store = useNotificationStore.getState;
    let es: EventSource | null = null;
    let retries = 0;
    let closed = false;

    registerSse(id);

    const connect = () => {
      es = new EventSource("/api/notifications/stream");

      es.onopen = () => {
        retries = 0;
        store().setConnected(true);
        setSseStatus(id, "connected");
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Partial<AppNotification> & {
            items?: AppNotification[];
            sound?: string;
          };
          if (Array.isArray(data.items)) {
            store().setItems(data.items);
          } else if (data.id && data.title) {
            const n: AppNotification = {
              id: data.id,
              title: data.title,
              description: data.description,
              icon: data.icon,
              href: data.href,
              kind: (data as { kind?: string }).kind,
              severity: (data as { severity?: string }).severity,
              read: false,
              createdAt: data.createdAt ?? new Date().toISOString(),
            };
            store().push(n);
            playSound(
              (data.sound as Parameters<typeof playSound>[0] | undefined) ??
                SOUND_BY_ICON[n.icon ?? ""] ??
                "notification",
              { volume: 0.7 }
            );
            const text = n.description ? `${n.title}: ${n.description}` : n.title;
            if (n.severity === "success") notify.success(text);
            else if (n.severity === "warning") notify.warning(text);
            else notify.info(text);
          }
        } catch {
          // Ignorar mensajes no JSON
        }
      };

      es.onerror = () => {
        es?.close();
        store().setConnected(false);
        setSseStatus(id, "reconnecting");
        if (!closed && retries < MAX_RETRIES) {
          retries += 1;
          const delay = Math.min(1000 * 2 ** retries, 15_000);
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      es?.close();
      unregisterSse(id);
    };
  }, [enabled]);
}
