"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/base/date-picker"
import { TimePicker } from "@/components/base/time-picker"
import { dateToTime } from "@/lib/dates"
import { CalendarClock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface DateTimePickerProps {
  id?: string
  value?: Date | null
  onChange?: (date: Date | null) => void
  dateProps?: Partial<React.ComponentProps<typeof DatePicker>>
  timeProps?: Partial<React.ComponentProps<typeof TimePicker>>
  className?: string
  disabled?: boolean
  label?: string
  required?: boolean
  error?: string
  helper?: React.ReactNode
}

export function DateTimePicker({
  id,
  value,
  onChange,
  dateProps,
  timeProps,
  className,
  disabled,
  label,
  required,
  error,
  helper,
}: DateTimePickerProps) {
  const time = value ? dateToTime(value) : null

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-4 text-muted-foreground" />
          <Label htmlFor={id ? `${id}-date` : undefined} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      <div
        role="group"
        aria-describedby={error && id ? `${id}-error` : undefined}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <DatePicker
          id={id ? `${id}-date` : undefined}
          value={value}
          disabled={disabled}
          error={error}
          showError={false}
          onChange={(d) => {
            if (!d) {
              onChange?.(null)
              return
            }
            const base = value ? new Date(value) : new Date()
            base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
            onChange?.(base)
          }}
          {...dateProps}
        />
        <TimePicker
          id={id ? `${id}-time` : undefined}
          value={time}
          disabled={disabled}
          error={error}
          showError={false}
          onChange={(t) => {
            if (!t) {
              const base = value ? new Date(value) : new Date()
              base.setHours(0, 0, 0, 0)
              onChange?.(value ? base : null)
              return
            }
            const base = value ? new Date(value) : new Date()
            const [h, m] = t.split(":").map(Number)
            base.setHours(h, m, 0, 0)
            onChange?.(base)
          }}
          size="sm"
          {...timeProps}
        />
      </div>
      {error && (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
