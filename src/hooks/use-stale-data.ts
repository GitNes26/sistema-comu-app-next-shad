"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minuto por defecto tras el cual los datos se consideran desactualizados. */
export const STALE_AFTER_MS = 60_000;

/**
 * Detecta datos desactualizados: la conexión en vivo se perdió (`live=false`)
 * y el último refresco exitoso es más viejo que `staleAfterMs`.
 *
 * `markFresh()` debe llamarse en cada carga exitosa de datos. Mientras haya
 * conexión en vivo el aviso no aparece (cada evento dispara refresco), aunque
 * el chequeo sigue corriendo por si la conexión cae sin que nadie refresque.
 */
export function useStaleData(live: boolean, staleAfterMs: number = STALE_AFTER_MS) {
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const liveRef = useRef(live);

  liveRef.current = live;

  /** Registrar una carga exitosa de datos (resetea el reloj de frescura). */
  const markFresh = useCallback(() => {
    setLastSuccessAt(Date.now());
  }, []);

  // Re-evaluar periódicamente para que el aviso aparezca/desaparezca sin
  // depender de un refresco de datos (que no llegará si el SSE está caído).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const lastSuccess = lastSuccessAt;
  const stale =
    !liveRef.current &&
    lastSuccess !== null &&
    now - lastSuccess > staleAfterMs;

  return {
    stale,
    /** Milisegundos desde el último refresco exitoso (null si nunca cargó). */
    ageMs: lastSuccess === null ? null : now - lastSuccess,
    markFresh,
  };
}
