"use client"

import { usePathname } from "next/navigation"
import { BackButton } from "@/components/shared/back-button"

/** Convención: toda página sin sidebar (el espacio personal /mi) lleva la flecha de regreso. */
export function MiBackButton() {
  const pathname = usePathname()
  if (pathname === "/mi") return null
  return <BackButton fallback="/mi" label="Regresar" className="-ml-1 shrink-0" />
}
