"use client";

import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useSseStore, selectSseSummary } from "@/stores/sse-store";

// Badge "En vivo" compartido: resume el estado SSE de las superficies con
// stream registradas en sse-store (KDS, mapa de mesas, notificaciones…).
// Verde pulsante = todas conectadas; ámbar = alguna reconectando o conectando
// por primera vez; gris = sin streams montados. `sources` limita el resumen a
// un subconjunto de ids; `compact` reduce el tamaño para diálogos/popovers.
export function LiveBadge({
  sources,
  compact = false,
  className,
}: {
  sources?: string[];
  compact?: boolean;
  className?: string;
}) {
  const allSources = useSseStore((s) => s.sources);
  const { any, all, everConnected } = selectSseSummary(allSources, sources);

  const live = any && all;
  const pending = any && !all;

  const label = live ? "En vivo" : everConnected ? "Reconectando…" : "Conectando…";

  return (
    <div
      title={
        live
          ? "Actualización en tiempo real conectada"
          : everConnected
            ? "Reconectando…"
            : "Conectando…"
      }
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        compact && "gap-1 px-1.5 py-0.5 text-[0.65rem]",
        live
          ? "bg-success/10 text-success-ink"
          : pending
            ? "bg-warning/10 text-warning-ink"
            : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Radio className={cn("size-3.5", compact && "size-3", live && "animate-pulse")} />
      {label}
    </div>
  );
}
