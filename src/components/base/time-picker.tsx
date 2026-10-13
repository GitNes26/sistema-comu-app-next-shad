"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

type TimePickerSize = "xs" | "sm" | "default" | "lg" | "xl" | "2xl" | "3xl" | "4xl"

const SIZE_MAP: Record<TimePickerSize, {
  container: string
  icon: string
  trigger: string
  dot: string
  clearBtn: string
  clearIcon: string
  placeholder: string
}> = {
  xs: {
    container: "h-6 gap-0.5 rounded px-1",
    icon: "size-3",
    trigger: "h-4 w-16 text-xs",
    dot: "text-xs",
    clearBtn: "size-5",
    clearIcon: "size-2.5",
    placeholder: "text-xs",
  },
  sm: {
    container: "h-7 gap-0.5 rounded-md px-1",
    icon: "size-3.5",
    trigger: "h-5 w-16 text-xs",
    dot: "text-xs",
    clearBtn: "size-6",
    clearIcon: "size-3",
    placeholder: "text-xs",
  },
  default: {
    container: "h-9 gap-1 rounded-md px-1.5",
    icon: "size-4",
    trigger: "h-4 w-16 text-sm",
    dot: "text-sm",
    clearBtn: "size-7",
    clearIcon: "size-3.5",
    placeholder: "text-sm",
  },
  lg: {
    container: "h-10 gap-1.5 rounded-lg px-2",
    icon: "size-5",
    trigger: "h-7 w-16 text-base",
    dot: "text-base",
    clearBtn: "size-8",
    clearIcon: "size-4",
    placeholder: "text-base",
  },
  xl: {
    container: "h-11 gap-1.5 rounded-lg px-2",
    icon: "size-5",
    trigger: "h-8 w-16 text-base",
    dot: "text-base",
    clearBtn: "size-9",
    clearIcon: "size-4.5",
    placeholder: "text-base",
  },
  "2xl": {
    container: "h-12 gap-2 rounded-xl px-2.5",
    icon: "size-6",
    trigger: "h-8 w-18 text-lg",
    dot: "text-lg",
    clearBtn: "size-10",
    clearIcon: "size-5",
    placeholder: "text-lg",
  },
  "3xl": {
    container: "h-14 gap-2 rounded-xl px-3",
    icon: "size-7",
    trigger: "h-10 w-20 text-xl",
    dot: "text-xl",
    clearBtn: "size-11",
    clearIcon: "size-5",
    placeholder: "text-xl",
  },
  "4xl": {
    container: "h-16 gap-2.5 rounded-2xl px-3",
    icon: "size-8",
    trigger: "h-12 w-22 text-2xl",
    dot: "text-2xl",
    clearBtn: "size-12",
    clearIcon: "size-6",
    placeholder: "text-2xl",
  },
}

export interface TimePickerProps {
  id?: string
  value?: string | null
  onChange?: (time: string | null) => void
  label?: string
  required?: boolean
  helper?: React.ReactNode
  disabled?: boolean
  clearable?: boolean
  error?: string
  showError?: boolean
  className?: string
  size?: TimePickerSize | `${number}`
}

export function TimePicker({
  id,
  value,
  onChange,
  label,
  required,
  helper,
  disabled,
  clearable = true,
  error,
  showError = true,
  className,
  size = "default",
}: TimePickerProps) {
  const parts = React.useMemo(() => parseTime(value), [value])
  const s = SIZE_MAP[size as TimePickerSize] ?? SIZE_MAP.default
  const autoId = React.useId().replace(/:/g, "")
  const pickerId = id ?? `time-${autoId}`

  const emit = (
    h: number | null,
    m: number | null,
    period: "AM" | "PM" | null
  ) => {
    const ch = h ?? parts.h
    const cm = m ?? parts.m
    const cp = period ?? parts.period
    if (ch === null || cm === null || cp === null) {
      onChange?.(null)
      return
    }
    let h24 = ch % 12
    if (cp === "PM") h24 += 12
    onChange?.(`${String(h24).padStart(2, "0")}:${String(cm).padStart(2, "0")}`)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`${pickerId}-hour`} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <div
        className={cn(
          "flex w-full items-center border border-input",
          s.container,
          error && "border-destructive ring-3 ring-destructive/20"
        )}
      >
        <Clock className={cn("shrink-0 text-muted-foreground", s.icon)} />
        <Select
          disabled={disabled}
          value={value ? String(parts.h) : undefined}
          onValueChange={(v) => emit(Number(v), null, null)}
        >
          <SelectTrigger
            id={`${pickerId}-hour`}
            data-slot="time-picker-part"
            className={cn(
              "border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0",
              s.trigger
            )}
            aria-label="Hora"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error && showError ? `${pickerId}-error` : undefined}
          >
            <SelectValue placeholder="Hora" className={s.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={cn("text-muted-foreground", s.dot)}>:</span>
        <Select
          disabled={disabled}
          value={value ? String(parts.m) : undefined}
          onValueChange={(v) => emit(null, Number(v), null)}
        >
          <SelectTrigger
            data-slot="time-picker-part"
            className={cn(
              "border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0",
              s.trigger
            )}
            aria-label="Minuto"
            aria-invalid={Boolean(error) || undefined}
          >
            <SelectValue placeholder="Min" className={s.placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            {MINUTES.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={disabled}
          value={value ? parts.period : undefined}
          onValueChange={(v) => emit(null, null, v as "AM" | "PM")}
        >
          <SelectTrigger
            data-slot="time-picker-part"
            className={cn(
              "border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0",
              s.trigger
            )}
            aria-label="Periodo"
            aria-invalid={Boolean(error) || undefined}
          >
            <SelectValue placeholder="AM/PM" className={s.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
        {clearable && value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Limpiar hora"
            className={cn("ml-auto", s.clearBtn)}
            onClick={() => onChange?.(null)}
          >
            <X className={s.clearIcon} />
          </Button>
        )}
      </div>

      {error && showError && <p id={`${pickerId}-error`} role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>}
    </div>
  )
}

export function parseTime(
  value?: string | null
): { h: number; m: number; period: "AM" | "PM" } {
  const d = value ? toDate(value) : null
  if (!d) return { h: 12, m: 0, period: "AM" }
  const h = d.getHours()
  const m = d.getMinutes()
  return {
    h: ((h + 11) % 12) + 1,
    m,
    period: h >= 12 ? "PM" : "AM",
  }
}

function toDate(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const d = new Date()
  d.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return d
}
