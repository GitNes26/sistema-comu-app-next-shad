"use client";

import type { ReactNode } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePersistedSplit } from "@/hooks/use-persisted-split";
import { cn } from "@/lib/utils";

export interface ResizableSplitProps {
  /** Prefijo de la clave de persistencia: fb.<prefix>.<eje>:<sede>. */
  prefix: string;
  /** Sede de contexto (id de la sede o "all"). */
  locationId: string;
  /** true = apaisado/ancho → split horizontal; false = estrecho → split vertical. */
  wide: boolean;
  /** Tamaños por defecto en %: [panel 1, panel 2]. */
  defaultSizes: [number, number];
  minSizes?: [number, number];
  maxSizes?: [number, number];
  /** Panel 1 (izquierda en ancho / arriba en estrecho). */
  first: ReactNode;
  /** Panel 2 (derecha en ancho / abajo en estrecho). */
  second: ReactNode;
  className?: string;
  handleClassName?: string;
}

/**
 * Split de paneles arrastrables reutilizable con la misma persistencia que el
 * POS: el reparto que deja el usuario al arrastrar se recuerda por pantalla,
 * eje y sede (usePersistedSplit), así sobrevive al recargar y al girar la
 * tablet. En modo ancho los paneles van en columnas (|); en modo estrecho en
 * filas (–) dentro de una altura acotada, para que el separador sea
 * arrastrable y cada panel scrollee internamente dentro de páginas con scroll.
 */
export function ResizableSplit({
  prefix,
  locationId,
  wide,
  defaultSizes,
  minSizes,
  maxSizes,
  first,
  second,
  className,
  handleClassName,
}: ResizableSplitProps) {
  const axis = wide ? "h" : "v";
  const { groupRef, onLayoutChanged } = usePersistedSplit(prefix, axis, locationId);

  const group = (
    <ResizablePanelGroup
      groupRef={groupRef}
      orientation={wide ? "horizontal" : "vertical"}
      onLayoutChanged={onLayoutChanged}
      className={cn("gap-0", className)}
    >
      {/* v4 interpreta números como píxeles y strings sin unidad como %:
          se convierten explícitamente a porcentaje. */}
      <ResizablePanel
        id={`${prefix}-first`}
        defaultSize={`${defaultSizes[0]}%`}
        minSize={minSizes ? `${minSizes[0]}%` : undefined}
        maxSize={maxSizes ? `${maxSizes[0]}%` : undefined}
        className={cn(wide ? "min-w-0" : "min-h-0")}
      >
        {first}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className={cn(
          !wide &&
            "h-2 w-full shrink-0 items-center justify-center bg-border/70",
          handleClassName
        )}
      />
      <ResizablePanel
        id={`${prefix}-second`}
        defaultSize={`${defaultSizes[1]}%`}
        minSize={minSizes ? `${minSizes[1]}%` : undefined}
        maxSize={maxSizes ? `${maxSizes[1]}%` : undefined}
        className={cn(wide ? "min-w-0" : "min-h-0")}
      >
        {second}
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  if (wide) return group;

  // Modo vertical dentro de páginas con scroll: altura acotada para que el
  // separador sea arrastrable; cada panel scrollea internamente si hace falta.
  return (
    <div className="h-[calc(100dvh-13rem)] min-h-[20rem] w-full">{group}</div>
  );
}