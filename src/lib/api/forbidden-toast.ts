"use client";

import { notify } from "@/lib/notify";

// UX de permisos: cuando un endpoint responde 403 (usuario
// autenticado sin permiso) se muestra un toast automático. Se instala una
// sola vez sobre window.fetch (idempotente) y no altera la respuesta: los
// callers siguen recibiendo su ApiError normalmente.

const FORBIDDEN_MESSAGE = "No tienes permiso para realizar esta acción.";

let installed = false;
let lastToastAt = 0;

function toastForbidden(serverError: string | undefined) {
  const now = Date.now();
  if (now - lastToastAt < 1500) return; // evita spam con peticiones en paralelo
  lastToastAt = now;
  void notify.error(serverError || FORBIDDEN_MESSAGE);
}

/** Instala el interceptor global de 403 (una sola vez, solo cliente). */
export function installForbiddenToast(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    if (res.status === 403) {
      try {
        const copy = res.clone();
        const body = (await copy.json().catch(() => null)) as { error?: string } | null;
        toastForbidden(body?.error);
      } catch {
        toastForbidden(undefined);
      }
    }
    return res;
  };
}