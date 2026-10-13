"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface InfoFieldProps {
  label?: React.ReactNode
  helper?: React.ReactNode
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  labelRowClassName?: string
}

export function InfoField({
  label,
  helper,
  required,
  error,
  hint,
  children,
  className,
  labelRowClassName,
}: InfoFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className={cn("flex items-center gap-1.5", labelRowClassName)}>
          {typeof label === "string" ? (
            <Label className="leading-none">
              {label}
              {required && <span className="text-destructive"> *</span>}
            </Label>
          ) : (
            label
          )}
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      {children}
      {error && (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}