"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { formatDate, DATE_FORMAT } from "@/lib/dates"

export interface DatePickerProps {
  id?: string
  value?: Date | null
  onChange?: (date: Date | null) => void
  onClear?: () => void
  label?: string
  required?: boolean
  helper?: React.ReactNode
  placeholder?: string
  disabled?: boolean
  disabledBefore?: Date
  disabledAfter?: Date
  fromYear?: number
  toYear?: number
  clearable?: boolean
  error?: string
  showError?: boolean
  className?: string
}

export function DatePicker({
  id,
  value,
  onChange,
  onClear,
  label,
  required,
  helper,
  placeholder = "dd/mm/aaaa",
  disabled,
  disabledBefore,
  disabledAfter,
  fromYear,
  toYear,
  clearable = true,
  error,
  showError = true,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const autoId = React.useId().replace(/:/g, "")
  const pickerId = id ?? `date-${autoId}`

  const disabledFn = React.useCallback(
    (d: Date) =>
      (disabledBefore ? d < startOfDay(disabledBefore) : false) ||
      (disabledAfter ? d > startOfDay(disabledAfter) : false),
    [disabledBefore, disabledAfter]
  )

  const startMonth = React.useMemo(
    () => (fromYear ? new Date(fromYear, 0, 1) : undefined),
    [fromYear]
  )
  const endMonth = React.useMemo(
    () => (toYear ? new Date(toYear, 11, 31) : undefined),
    [toYear]
  )

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={pickerId} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={pickerId}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label="Elegir fecha"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error && showError ? `${pickerId}-error` : undefined}
            className={cn(
              "relative h-8 w-full justify-start px-3 text-left font-normal",
              error && "border-destructive ring-3 ring-destructive/20",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              {value ? formatDate(value, DATE_FORMAT) : placeholder}
            </span>
            {clearable && value && !disabled && onClear ? (
              <span
                role="button"
                aria-label="Limpiar fecha"
                tabIndex={-1}
                className="cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear?.()
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value || undefined}
            onSelect={(d) => {
              onChange?.(d ?? null)
              if (d) setOpen(false)
            }}
            disabled={disabledFn}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={value || undefined}
          />
        </PopoverContent>
      </Popover>

      {error && showError && (
        <p id={`${pickerId}-error`} role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  )
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
