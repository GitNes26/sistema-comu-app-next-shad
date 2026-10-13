"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Encabezado de un asistente por pasos: número, título corto y ayuda del paso
// actual. Los pasos ya completados se pueden tocar para regresar.

export interface WizardStep {
  title: string
  /** Frase que explica qué se hace en este paso. */
  hint?: string
}

export function WizardSteps({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: WizardStep[]
  current: number
  /** Permite volver a un paso anterior. */
  onStepClick?: (index: number) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <ol className="flex items-center gap-1.5" aria-label="Pasos">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          const clickable = done && onStepClick
          return (
            <li key={step.title} className="flex min-w-0 flex-1 items-center gap-1.5" aria-current={active ? "step" : undefined}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(i)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-left text-sm transition-colors",
                  active && "bg-primary/10 font-semibold text-primary",
                  done && "text-foreground hover:bg-muted",
                  !done && !active && "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                    done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("truncate", !active && "max-sm:hidden")}>{step.title}</span>
              </button>
              {i < steps.length - 1 && <span className={cn("h-0.5 min-w-3 flex-1 rounded", done ? "bg-primary" : "bg-muted")} />}
            </li>
          )
        })}
      </ol>
      {steps[current]?.hint && <p className="text-sm text-muted-foreground">{steps[current].hint}</p>}
    </div>
  )
}
