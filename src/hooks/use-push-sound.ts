"use client";

import { useEffect } from "react";
import { playSound, type SoundName } from "@/lib/sounds";

/**
 * Hook que escucha mensajes del Service Worker (push-sound)
 * y reproduce el sonido correspondiente cuando llega una notificación push.
 * Usar en el admin header o en componentes que necesiten sonido push.
 */
export function usePushSound() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "push-sound") {
        const soundName = (event.data.sound as string) || "order-received";
        // Validar que el sonido existe en el catálogo
        const validSounds: SoundName[] = [
          "notification",
          "sale-complete",
          "error",
          "scan",
          "cash-open",
          "cash-close",
          "order-received",
          "order-ready",
          "low-stock",
        ];
        const name = validSounds.includes(soundName as SoundName)
          ? (soundName as SoundName)
          : "order-received";
        playSound(name, { volume: 0.8 });
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
}
