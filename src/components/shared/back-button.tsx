"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Flecha de regreso. Si el usuario llegó desde otra página del mismo sitio,
 * vuelve a ella (como el "atrás" del navegador); si abrió el enlace directo
 * (nueva pestaña, correo, QR), va a `fallback`.
 */
export function BackButton({
  fallback = "/",
  label = "Regresar",
  showLabel = false,
  className,
}: {
  fallback?: string
  label?: string
  /** Muestra el texto junto a la flecha (en pantallas medianas en adelante). */
  showLabel?: boolean
  className?: string
}) {
  const router = useRouter()

  const goBack = () => {
    const sameOriginReferrer =
      typeof document !== "undefined" &&
      document.referrer !== "" &&
      new URL(document.referrer).origin === window.location.origin
    if (sameOriginReferrer && window.history.length > 1) router.back()
    else router.push(fallback)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={goBack}
      aria-label={label}
      className={cn("text-muted-foreground hover:text-foreground", showLabel && "-ml-2 gap-1.5 px-2", className)}
    >
      <ArrowLeft className="size-5" />
      {showLabel && <span className="hidden sm:inline">{label}</span>}
    </Button>
  )
}
