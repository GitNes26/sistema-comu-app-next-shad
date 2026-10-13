"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Suscripción SSR-segura a una media query (matchMedia). Devuelve `false` en
 * el primer render del servidor y se actualiza en el cliente sin romper la
 * hidratación. Útil para decisiones de layout sensibles a orientación/tamaño
 * (p. ej. POS en tablet vertical vs apaisada).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    // SSR / hidratación inicial: evitar mismatch marcando falso.
    () => false
  );
}
