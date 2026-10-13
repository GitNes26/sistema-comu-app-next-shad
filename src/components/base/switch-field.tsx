"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ToggleLeft } from "lucide-react"
import { InfoTooltip } from "@/components/base/info-tooltip"

interface SwitchFieldProps {
  id?: string
  label: string
  description?: string
  infoTooltip?: React.ReactNode | null
  icon?: React.ReactNode
  checked?: boolean | null
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  border?: boolean
  required?: boolean
  error?: string
}

export function SwitchField({
  id,
  label,
  description,
  infoTooltip,
  icon,
  checked,
  onCheckedChange,
  disabled,
  className,
  border = true,
  required,
  error,
}: SwitchFieldProps) {
  const switchId = id ?? `switch-${label.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className={cn(
          "flex min-h-11 items-center justify-between gap-3 rounded-lg",
          border && "border p-2.5",
          disabled && "opacity-50",
          error && "border-destructive ring-3 ring-destructive/20"
        )}
      >
        <label htmlFor={switchId} className="flex min-w-0 cursor-pointer items-center gap-2">
          <span className="shrink-0 text-muted-foreground">
            {icon ?? <ToggleLeft className="size-4" />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <span>{label}{required && <span className="text-destructive"> *</span>}</span>
              {infoTooltip && <InfoTooltip text={infoTooltip} />}
            </span>
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </span>
        </label>
        <Switch
          id={switchId}
          checked={checked ?? false}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${switchId}-error` : undefined}
        />
      </div>
      {error ? (
        <p id={`${switchId}-error`} role="alert" className="text-xs leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
