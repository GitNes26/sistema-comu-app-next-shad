"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  const ref = React.useRef<HTMLDivElement>(null)
  const [edge, setEdge] = React.useState({ left: false, right: false })

  const measure = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
  }, [])

  React.useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    // La opción activa queda a la vista al montar o cambiar.
    el.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, options.length, value])

  const scrollBy = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * Math.max(120, (ref.current?.clientWidth ?? 240) * 0.6), behavior: "smooth" })

  return (
    <div className="relative flex max-w-full min-w-0">
      {edge.left && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver opciones anteriores"
          onClick={() => scrollBy(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-7 items-center justify-start rounded-l-xl bg-gradient-to-r from-muted from-60% to-transparent pl-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        ref={ref}
        onScroll={measure}
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn("scrollbar-none flex w-full max-w-full overflow-x-auto rounded-xl bg-muted p-1", className)}
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
      {edge.right && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver más opciones"
          onClick={() => scrollBy(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-7 items-center justify-end rounded-r-xl bg-gradient-to-l from-muted from-60% to-transparent pr-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}
