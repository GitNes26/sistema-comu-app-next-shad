"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DEFAULT_HIERARCHY, HIERARCHY_LEVELS, resolveHierarchy, type HierarchyEntry } from "@/lib/org/hierarchy"

// Nombres de la jerarquía de la iglesia (editables en Ajustes → Jerarquía). Mientras llegan, o si
// no hay sesión (login), se usan los nombres por defecto.

export const HIERARCHY_QUERY_KEY = ["hierarchy"] as const

export function useHierarchy() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: HIERARCHY_QUERY_KEY,
    queryFn: async (): Promise<HierarchyEntry[]> => {
      const res = await fetch("/api/settings/hierarchy", { cache: "no-store" })
      if (!res.ok) return resolveHierarchy(null)
      const json = (await res.json()) as { hierarchy?: HierarchyEntry[] }
      return json.hierarchy ?? resolveHierarchy(null)
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
  const entries = data ?? resolveHierarchy(null)
  return useMemo(() => {
    const labels = Object.fromEntries(entries.map((e) => [e.level, e.label])) as Record<string, string>
    return {
      entries,
      labels,
      /** Nombre visible de un nivel (o el valor tal cual si no se conoce). */
      labelOf: (level: string | null | undefined) => (level ? (labels[level] ?? DEFAULT_HIERARCHY[level as keyof typeof DEFAULT_HIERARCHY]?.label ?? level) : ""),
      /** Opciones para selectores: solo niveles activos (más el actual, si estuviera oculto). */
      optionsFor: (current?: string | null) => entries.filter((e) => e.isActive || e.level === current).map((e) => ({ value: e.level, label: e.label })),
      /** Todas las opciones, para filtros y etiquetas. */
      allOptions: HIERARCHY_LEVELS.map((l) => ({ value: l, label: labels[l] })),
      refresh: () => qc.invalidateQueries({ queryKey: HIERARCHY_QUERY_KEY }),
    }
  }, [entries, qc])
}
