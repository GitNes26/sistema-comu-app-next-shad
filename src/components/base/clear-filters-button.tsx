"use client"

import { FilterX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Botón estándar para regresar los filtros de una búsqueda a sus valores por defecto.
 * Solo aparece cuando hay algún filtro distinto del predeterminado (`active`).
 */
export function ClearFiltersButton({ active, onClear, className }: { active: boolean; onClear: () => void; className?: string }) {
  if (!active) return null
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear} className={cn("text-muted-foreground", className)}>
      <FilterX className="size-4" /> Limpiar filtros
    </Button>
  )
}
