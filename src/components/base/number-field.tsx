"use client"

import * as React from "react"
import { Hash, Minus, Plus, Type, type LucideIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { cn } from "@/lib/utils"
import { inferFieldIcon } from "@/lib/field-icons"

// Campo de cantidad entera: icono acorde con el dato, número editable y botones − / +
// para subir o bajar (también con las flechas del teclado). Ajusta al rango al salir del campo.

export interface NumberFieldProps {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Icono propio; si falta se infiere de la etiqueta. */
  icon?: LucideIcon
  helper?: React.ReactNode
  unit?: string
  disabled?: boolean
  required?: boolean
  id?: string
  containerClassName?: string
  "aria-label"?: string
}

export function NumberField({ label, value, onChange, min = 0, max, step = 1, icon, helper, unit, disabled, required, id, containerClassName, "aria-label": ariaLabel }: NumberFieldProps) {
  const autoId = React.useId().replace(/:/g, "")
  const inputId = id ?? `num-${autoId}`
  const inferred = inferFieldIcon(label)
  const Icon = icon ?? (inferred === Type ? Hash : inferred)
  const [draft, setDraft] = React.useState<string | null>(null)

  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, Math.round(n)))
  const set = (n: number) => {
    const next = clamp(n)
    if (next !== value) onChange(next)
  }
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^\d-]/g, ""))
    setDraft(null)
    if (raw.trim() !== "" && Number.isFinite(n)) set(n)
  }
  const atMin = value <= min
  const atMax = max !== undefined && value >= max

  const stepBtn = "press grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 desk:size-7"

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={inputId} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      <div
        className={cn(
          "flex h-11 items-center gap-1 rounded-xl border border-input bg-transparent pr-1 pl-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 desk:h-9 desk:rounded-lg dark:bg-input/30",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={inputId}
          aria-label={ariaLabel ?? label}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={draft ?? String(value)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, ""))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault()
              set(value + (e.shiftKey ? step * 10 : step))
              setDraft(null)
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              set(value - (e.shiftKey ? step * 10 : step))
              setDraft(null)
            } else if (e.key === "Enter") commit(e.currentTarget.value)
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-base tabular-nums outline-none desk:text-sm"
        />
        {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
        <button type="button" tabIndex={-1} aria-label={`Bajar${label ? ` ${label.toLowerCase()}` : ""}`} disabled={disabled || atMin} onClick={() => set(value - step)} className={stepBtn}>
          <Minus className="size-4" />
        </button>
        <button type="button" tabIndex={-1} aria-label={`Subir${label ? ` ${label.toLowerCase()}` : ""}`} disabled={disabled || atMax} onClick={() => set(value + step)} className={stepBtn}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
