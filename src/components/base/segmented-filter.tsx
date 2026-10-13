"use client"

import { cn } from "@/lib/utils"
import type { StatusTone } from "./status-pill"

// Filtro segmentado (radiogroup) con conteo opcional. Se usa para filtros
// rápidos de listados: estado, periodo, tipo de ubicación, etc.

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Conteo mostrado junto a la etiqueta. */
  count?: number
  /** Resalta el conteo cuando es > 0 (p. ej. "Agotados" en rojo). */
  countTone?: Extract<StatusTone, "warning" | "danger" | "info">
}

const COUNT_TONE = {
  warning: "bg-warning/20 text-warning-ink",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info-ink",
} as const

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("scrollbar-none flex max-w-full overflow-x-auto rounded-xl bg-muted p-1", className)}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value || "__all__"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 desk:h-7",
              active ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  opt.countTone && opt.count > 0 ? COUNT_TONE[opt.countTone] : "text-muted-foreground"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
