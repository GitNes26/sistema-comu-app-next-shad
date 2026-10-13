"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { inferInputKind } from "@/lib/input-kind"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { AlertCircle, Eye, EyeOff, Hash, KeyRound, Mail, Phone, Type } from "lucide-react"

export interface InputGroupFieldProps
  extends React.ComponentProps<typeof Input> {
  label?: string
  helper?: React.ReactNode
  type?: React.HTMLInputTypeAttribute | undefined
  hint?: string
  error?: string
  required?: boolean
  leftIcon?: React.ReactNode
  leftAddon?: React.ReactNode
  rightAddon?: React.ReactNode
  containerClassName?: string
}

export const InputGroupField = React.forwardRef<
  HTMLInputElement,
  InputGroupFieldProps
>(function InputGroupField(
  {
    label,
    helper,
    hint,
    type: typeProp,
    error,
    required,
    leftIcon,
    leftAddon,
    rightAddon,
    className,
    containerClassName,
    id,
    ...props
  },
  ref
) {
  const [hasError] = useForwardedError(error)
  // Teléfono, correo y URL se reconocen por su etiqueta para dar el teclado correcto en celulares.
  const guessed = inferInputKind(label)
  const type = typeProp ?? (guessed && guessed !== "search" && guessed !== "number" ? guessed : undefined)
  const autoId = React.useId().replace(/:/g, "")
  const inputId = id ?? `field-${autoId}`
  const isPassword = type === "password"
  const [showPassword, setShowPassword] = React.useState(false)
  const defaultIcon = type === "email"
    ? <Mail className="size-4" />
    : type === "tel"
      ? <Phone className="size-4" />
      : type === "number"
        ? <Hash className="size-4" />
        : type === "password"
          ? <KeyRound className="size-4" />
          : <Type className="size-4" />
  const resolvedLeftIcon = leftIcon ?? (leftAddon ? undefined : defaultIcon)

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
      <div className="relative">
        {resolvedLeftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            {resolvedLeftIcon}
          </span>
        )}
        {leftAddon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
            {leftAddon}
          </span>
        )}
        <Input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : hint ? `${inputId}-describe` : undefined
          }
          className={cn(
            (resolvedLeftIcon || leftAddon) && "pl-9 md:pl-9 desk:pl-9",
            isPassword && "pr-10 md:pr-10 desk:pr-10",
            rightAddon && !hasError && "pr-16 md:pr-16 desk:pr-16",
            hasError && !isPassword && "pr-9 md:pr-9 desk:pr-9",
            className
          )}
          type={isPassword && showPassword ? "text" : type}
          {...props}
        />
        {hasError && !isPassword && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-destructive">
            <AlertCircle className="size-4" />
          </span>
        )}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
        {rightAddon && !hasError && !isPassword && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
            {rightAddon}
          </span>
        )}
      </div>
      {hint && !hasError && (
        <p
          id={`${inputId}-describe`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="flex items-center gap-1 text-xs leading-relaxed text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
})

function useForwardedError(error?: string) {
  return React.useMemo(
    () => [Boolean(error)] as const,
    [error]
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
