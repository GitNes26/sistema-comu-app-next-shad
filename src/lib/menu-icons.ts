import { icons } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Registro dinámico de TODOS los íconos de Lucide.
// Se importan automáticamente desde lucide-react; no hace falta agregar
// íconos manualmente cuando Lucide libere nuevos.

/** Mapa nombre → componente Lucide (generado dinámicamente). */
export const MENU_ICONS: Record<string, LucideIcon> = icons as Record<
  string,
  LucideIcon
>;

/** Nombres ordenados alfabéticamente para el combobox del admin. */
export const MENU_ICON_NAMES = Object.keys(MENU_ICONS).sort();

/**
 * Resuelve un nombre de ícono string al componente Lucide.
 * Si el nombre no existe, devuelve Circle como fallback.
 */
export function resolveMenuIcon(name: string | null | undefined): LucideIcon {
  if (!name) return icons.Circle;
  return MENU_ICONS[name] ?? icons.Circle;
}
