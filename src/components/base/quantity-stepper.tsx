"use client"

import { useEffect, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

// Selector de cantidad táctil: botones grandes − / + y el número editable al
// centro. Se usa en combos, compras, traslados y el armado de productos.

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  decimals = 0,
  size = "md",
  unit,
  ariaLabel = "Cantidad",
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Decimales permitidos al escribir (granel: 3). */
  decimals?: number
  size?: "sm" | "md" | "lg"
  unit?: string | null
  ariaLabel?: string
  className?: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const clamp = (n: number) => {
    const factor = 10 ** decimals
    const rounded = Math.round(n * factor) / factor
    return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, rounded))
  }
  const commit = (raw: string) => {
    const n = Number(raw.replace(",", "."))
    const next = Number.isFinite(n) ? clamp(n) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const btn = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10 desk:size-9"
  const atMin = value <= min
  const atMax = max != null && value >= max

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center rounded-xl border bg-background p-1 shadow-e1", className)}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={atMin}
        aria-label="Quitar uno"
        className={cn("press grid shrink-0 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-35", btn)}
      >
        <Minus className="size-4" />
      </button>
      <label className="flex min-w-0 items-baseline justify-center gap-1 px-1">
        <input
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
          aria-label={ariaLabel}
          className={cn(
            "w-[4.5ch] bg-transparent text-center font-semibold tabular-nums outline-none",
            size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base"
          )}
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </label>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={atMax}
        aria-label="Agregar uno"
        className={cn("press grid shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-35", btn)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
