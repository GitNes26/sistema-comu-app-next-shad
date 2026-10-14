"use client"

import { useEffect } from "react"
import { applyAppearanceToDom } from "@/lib/appearance-apply"

/** Aplica los colores de la iglesia a la cara pública (que no tiene sesión ni AppSettings en cliente). */
export function PublicTheme({ primary, accent }: { primary?: number; accent?: number }) {
  useEffect(() => {
    applyAppearanceToDom(
      "system",
      { ...(primary !== undefined ? { primaryHue: primary } : {}), ...(accent !== undefined ? { accentHue: accent } : {}) },
      undefined
    )
  }, [primary, accent])
  return null
}
