import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Cargando…</span>}
    </span>
  )
}