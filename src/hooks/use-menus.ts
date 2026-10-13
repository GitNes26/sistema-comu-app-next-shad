"use client";

import { useEffect, useState } from "react";
import {
  menuTreeToBottomItems,
  menuTreeToSections,
  type NavItem,
  type NavSection,
} from "@/lib/nav";
import type { MenuNode } from "@/lib/menus/server";

// FASE 14.5/14.7 — Carga el árbol de menú desde la BD (filtrado por permisos
// en el servidor) y lo convierte a secciones/items para la navegación.

const CACHE_KEY = "comu-app-menu";

export function useMenus() {
  const [sections, setSections] = useState<NavSection[] | null>(null);
  const [bottomItems, setBottomItems] = useState<NavItem[] | null>(null);

  useEffect(() => {
    let active = true;
    const apply = (menu: MenuNode[]) => {
      setSections(menuTreeToSections(menu));
      setBottomItems(menuTreeToBottomItems(menu));
    };
    // Último menú de esta pestaña: se pinta al instante al recargar, en lugar
    // del menú genérico, y la respuesta del servidor lo actualiza después.
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) apply(JSON.parse(cached) as MenuNode[]);
    } catch {
      // almacenamiento no disponible: se espera al servidor
    }
    fetch("/api/menus", { headers: { "Content-Type": "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; menu?: MenuNode[] } | null) => {
        if (!active || !data?.ok || !data.menu) return;
        apply(data.menu);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data.menu));
        } catch {
          // sin caché
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return { sections, bottomItems };
}
