import { cn } from "@/lib/utils"

// Etiqueta de estado del sistema: un solo lenguaje visual para "activo",
// "agotado", "pagado", "pendiente", etc. en todas las pantallas.

export type StatusTone = "success" | "warning" | "danger" | "info" | "primary" | "neutral"

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success/12 text-success-ink", dot: "bg-success" },
  warning: { pill: "bg-warning/15 text-warning-ink", dot: "bg-warning" },
  danger: { pill: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  info: { pill: "bg-info/12 text-info-ink", dot: "bg-info" },
  primary: { pill: "bg-primary/12 text-primary", dot: "bg-primary" },
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

export function StatusPill({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: StatusTone
  dot?: boolean
  className?: string
  children: React.ReactNode
}) {
  const t = TONES[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        t.pill,
        className
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />}
      {children}
    </span>
  )
}
