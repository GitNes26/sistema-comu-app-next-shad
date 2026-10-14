"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { inferFieldIcon } from "@/lib/field-icons"

export interface TextareaFieldProps extends React.ComponentProps<typeof Textarea> {
  label?: string
  helper?: React.ReactNode
  hint?: string
  error?: string
  required?: boolean
  /** Icono del campo; si se omite se infiere de la etiqueta (notas, descripción, mensaje…). */
  icon?: React.ReactNode
  containerClassName?: string
}

/** Texto largo con el mismo contrato que `InputGroupField`: etiqueta, icono acorde al dato,
 *  ayuda, pista y error. Reemplaza al par `Label` + `Textarea` sueltos. */
export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, helper, hint, error, required, icon, containerClassName, className, id, ...props },
  ref
) {
  const autoId = React.useId().replace(/:/g, "")
  const fieldId = id ?? `textarea-${autoId}`
  const Icon = inferFieldIcon(label, { name: props.name })
  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground [&_svg]:size-4">{icon ?? <Icon />}</span>
          <Label htmlFor={fieldId} className="cursor-pointer leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      <Textarea
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-describe` : undefined}
        className={className}
        {...props}
      />
      {hint && !error && (
        <p id={`${fieldId}-describe`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="flex items-center gap-1 text-xs leading-relaxed text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
})
