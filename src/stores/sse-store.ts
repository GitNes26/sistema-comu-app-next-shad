import { create } from "zustand";

// Estado global de las conexiones SSE "En vivo" de la app. Cada superficie con
// stream en tiempo real (parrilla KDS, tablero de entregas, mapa de mesas,
// notificaciones…) registra una fuente por id y reporta su estado; el badge
// compartido (LiveBadge) resume las fuentes registradas: verde solo si todas
// están conectadas, ámbar mientras alguna reconecta (o conecta por primera
// vez), gris si no hay streams montados. `everConnected` distingue "conectando"
// (nunca hubo conexión) de "reconectando" (se cortó una conexión viva).
type SseState = "connecting" | "connected" | "reconnecting";

interface SseStatus {
  connected: boolean;
  everConnected: boolean;
}

interface SseStore {
  sources: Record<string, SseStatus>;
  register: (id: string) => void;
  unregister: (id: string) => void;
  setStatus: (id: string, state: SseState) => void;
}

export const useSseStore = create<SseStore>((set) => ({
  sources: {},
  register: (id) =>
    set((s) =>
      id in s.sources
        ? s
        : { sources: { ...s.sources, [id]: { connected: false, everConnected: false } } }
    ),
  unregister: (id) =>
    set((s) => {
      if (!(id in s.sources)) return s;
      const next = { ...s.sources };
      delete next[id];
      return { sources: next };
    }),
  setStatus: (id, state) =>
    set((s) => {
      const prev = s.sources[id];
      const connected = state === "connected";
      const next = {
        connected,
        everConnected: prev?.everConnected || connected,
      };
      if (prev?.connected === next.connected && prev?.everConnected === next.everConnected) {
        return s;
      }
      return { sources: { ...s.sources, [id]: next } };
    }),
}));

/**
 * Resumen agregado de las suscripciones registradas (o de un subconjunto).
 * `label` elige el texto del badge: reconectando solo si TODAS las fuentes
 * caídas ya tenían conexión antes; si alguna nunca conectó, está conectando.
 */
export function selectSseSummary(sources: Record<string, SseStatus>, only?: string[]) {
  const ids = only ? only.filter((id) => id in sources) : Object.keys(sources);
  if (ids.length === 0) return { any: false, all: false, everConnected: false };
  const fallen = ids.filter((id) => !sources[id].connected);
  const everConnected = fallen.every((id) => sources[id].everConnected);
  return { any: true, all: fallen.length === 0, everConnected };
}
