"use client";

import { useCallback, useEffect } from "react";
import { useGroupRef } from "react-resizable-panels";
import type { Layout, LayoutChangedMeta } from "react-resizable-panels";

/**
 * Persistencia reutilizable de paneles arrastrables (react-resizable-panels
 * v4). Guarda/restaura el reparto del usuario en localStorage por pantalla
 * (`prefix`), eje (`v`/`h`) y sede (`locationId`):
 *
 *   fb.{prefix}.{eje}:{locationId}
 *
 * - Carga tras el montaje (no durante el render, para no romper la hidratación
 *   SSR) con validación contra datos corruptos.
 * - Guarda solo cuando el usuario arrastra el separador (ignora resizes y el
 *   propio setLayout de carga), así no se pisa la preferencia con defaults.
 *
 * Es el mismo patrón del POS (`fb.pos-split.h:{locationId}`), extraído para
 * que pedidos/mesas/reportes lo reutilicen por sede y eje.
 */
export function usePersistedSplit(
  prefix: string,
  axis: "v" | "h",
  locationId: string
) {
  const groupRef = useGroupRef();
  const storageKey = `fb.${prefix}.${axis}:${locationId}`;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Layout;
      if (saved && typeof saved === "object") group.setLayout(saved);
    } catch {
      // Almacenamiento no disponible o dato corrupto: se mantiene el default.
    }
  }, [groupRef, storageKey]);

  const onLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(layout));
      } catch {
        // Sin almacenamiento (incógnito / bloqueado): se ignora.
      }
    },
    [storageKey]
  );

  return { groupRef, onLayoutChanged, storageKey };
}