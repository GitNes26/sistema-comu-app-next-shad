"use client";

import { WifiOff } from "lucide-react";

// Aviso de datos desactualizados para tableros en tiempo real: aparece cuando
// el SSE está caído y el último refresco exitoso lleva más de un minuto.
export function StaleBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-warning/60 bg-warning/10 px-3 py-2 text-sm text-warning-ink"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>
        <span className="font-semibold">Sin conexión en vivo.</span> Los pedidos mostrados pueden
        estar desactualizados — verifica manualmente o recarga la página.
      </span>
    </div>
  );
}
