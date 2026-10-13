"use client"

import { forwardRef, useCallback } from "react"
import { SnackbarContent, SnackbarProvider, closeSnackbar, type CustomContentProps } from "notistack"
import { CircleCheck, Info, OctagonX, TriangleAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Aviso con tokens semánticos del sistema (plano, ring en lugar de sombra).
// Las animaciones de entrada/salida las resuelve notistack; con
// prefers-reduced-motion se reduce a aparición instantánea vía CSS global.

const TONES = {
  success: { icon: CircleCheck, accent: "text-success-ink" },
  error: { icon: OctagonX, accent: "text-destructive" },
  warning: { icon: TriangleAlert, accent: "text-warning-ink" },
  info: { icon: Info, accent: "text-info-ink" },
  default: { icon: Info, accent: "text-muted-foreground" },
} as const

const NotifySnack = forwardRef<HTMLDivElement, CustomContentProps>(function NotifySnack(
  { id, message, variant },
  ref
) {
  const tone = TONES[variant] ?? TONES.default
  const Icon = tone.icon
  return (
    <SnackbarContent ref={ref} role="status" className="w-full sm:w-auto">
      <div
        className={cn(
          "pointer-events-auto flex w-full min-w-[16rem] max-w-[min(92vw,28rem)] items-start gap-3 rounded-xl",
          "bg-popover px-3.5 py-3 text-sm text-popover-foreground ring-1 ring-foreground/10"
        )}
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", tone.accent)} aria-hidden />
        <p className="min-w-0 flex-1 leading-snug">{message}</p>
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => closeSnackbar(id)}
          className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </button>
      </div>
    </SnackbarContent>
  )
})

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const isNarrow = useCallback(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
    []
  )
  return (
    <SnackbarProvider
      maxSnack={3}
      preventDuplicate
      autoHideDuration={3000}
      anchorOrigin={
        isNarrow()
          ? { vertical: "top", horizontal: "center" }
          : { vertical: "bottom", horizontal: "right" }
      }
      Components={{
        success: NotifySnack,
        error: NotifySnack,
        warning: NotifySnack,
        info: NotifySnack,
        default: NotifySnack,
      }}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {children}
    </SnackbarProvider>
  )
}
