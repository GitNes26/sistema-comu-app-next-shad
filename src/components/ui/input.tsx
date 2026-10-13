import * as React from "react"

import { cn } from "@/lib/utils"
import { inferInputKind, inputModeFor } from "@/lib/input-kind"

function Input({ className, type: typeProp, value, onChange, onFocus, onBlur, ...props }: React.ComponentProps<"input">) {
  // Sin `type`, el campo se reconoce por su texto («Buscar…», «Teléfono»…) para dar el teclado correcto.
  const type = typeProp ?? (typeof props.placeholder === "string" ? (inferInputKind(props.placeholder) === "search" ? "search" : undefined) : undefined)
  const controlledNumber = type === "number" && value !== undefined
  const [numberDraft, setNumberDraft] = React.useState(() => controlledNumber ? String(value ?? "") : "")
  const [editingNumber, setEditingNumber] = React.useState(false)

  React.useEffect(() => {
    if (controlledNumber && !(editingNumber && numberDraft === "")) setNumberDraft(String(value ?? ""))
  }, [controlledNumber, editingNumber, numberDraft, value])

  return (
    <input
      type={type}
      inputMode={inputModeFor(type, props.step)}
      enterKeyHint={type === "search" ? "search" : undefined}
      autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
      value={controlledNumber ? numberDraft : value}
      onChange={(event) => {
        if (controlledNumber) setNumberDraft(event.target.value)
        onChange?.(event)
      }}
      onFocus={(event) => { if (controlledNumber) setEditingNumber(true); onFocus?.(event) }}
      onBlur={(event) => { if (controlledNumber) { setEditingNumber(false); setNumberDraft(String(value ?? "")) }; onBlur?.(event) }}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 desk:h-9 desk:rounded-lg desk:px-2.5 desk:py-1 desk:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
