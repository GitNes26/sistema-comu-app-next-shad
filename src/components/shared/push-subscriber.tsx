"use client";

import { useEffect, useState, useCallback } from "react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/shared/tooltip-button";

/**
 * Componente que gestiona la suscripción Web Push del cliente/admin.
 * Muestra un botón para activar/desactivar notificaciones push.
 * Se auto-suscribe silenciosamente si el permiso ya fue otorgado.
 */
export function PushSubscriber() {
  const { subscribe, unsubscribe, isSubscribed } = usePushSubscription();
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setChecking(false);
      return;
    }
    setSupported(true);

    (async () => {
      try {
        // Si el service worker no llega a estar listo, no se deja el spinner colgado.
        const alreadySubscribed = await Promise.race([isSubscribed(), new Promise<boolean>((r) => setTimeout(() => r(false), 4000))]);
        setSubscribed(alreadySubscribed);

        // Auto-suscribir silenciosamente si el permiso ya fue dado
        if (!alreadySubscribed && Notification.permission === "granted") {
          const ok = await subscribe();
          setSubscribed(ok);
        }
      } catch {
        // noop
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribe();
        setSubscribed(false);
      } else {
        // Si el permiso fue denegado, informar al usuario
        if ("Notification" in window && Notification.permission === "denied") {
          setError("Permiso denegado. Activa notificaciones en la configuración del navegador.");
          return;
        }
        const ok = await subscribe();
        if (ok) {
          setSubscribed(true);
        } else {
          setError("No se pudo activar. Verifica que el navegador permita notificaciones.");
        }
      }
    } catch {
      setError("Error al cambiar configuración de notificaciones.");
    } finally {
      setToggling(false);
    }
  }, [subscribed, subscribe, unsubscribe, toggling]);

  // Sin soporte del navegador o sin llaves VAPID configuradas no hay nada que activar.
  if (!supported || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;

  // Durante verificación inicial, mostrar spinner sutil
  if (checking) {
    return (
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <TooltipButton
        label={
          error
            ? error
            : subscribed
            ? "Notificaciones push activadas — click para desactivar"
            : "Activar notificaciones push"
        }
        side="bottom"
        variant={subscribed ? "default" : "outline"}
        size="icon"
        className="size-8"
        onClick={toggle}
        disabled={toggling}
      >
        {toggling ? (
          <Loader2 className="size-4 animate-spin" />
        ) : subscribed ? (
          <Bell className="size-4" />
        ) : (
          <BellOff className="size-4" />
        )}
      </TooltipButton>

      {/* Error tooltip */}
      {error && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-md">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="mt-1 text-muted-foreground underline"
            onClick={() => setError(null)}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
