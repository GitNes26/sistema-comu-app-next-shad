"use client";

import { useRef, useCallback } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Convierte una VAPID public key (base64url) a Uint8Array para el browser.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Hook que gestiona la suscripción Web Push del cliente.
 * - Registra el service worker
 * - Solicita permiso de notificación
 * - Se suscribe/desuscribe a push
 * - Limpia suscripciones al desmontar (logout)
 */
export function usePushSubscription() {
  const subscriptionRef = useRef<PushSubscription | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      swRegistrationRef.current = registration;

      // Verificar si ya hay suscripción existente
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Crear nueva suscripción
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        });
      }

      subscriptionRef.current = subscription;

      // Enviar al servidor
      const { endpoint } = subscription;
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint, p256dh, auth }),
      });

      return res.ok;
    } catch (err) {
      console.warn("[push] subscribe failed:", err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      if (subscriptionRef.current) {
        await subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      // Notificar al servidor para limpiar
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
    } catch {
      // noop
    }
  }, []);

  const isSubscribed = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }, []);

  return { subscribe, unsubscribe, isSubscribed };
}
