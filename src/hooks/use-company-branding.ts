"use client"

import { useEffect, useState } from "react"

export interface CompanyBranding {
  name: string
  logoUrl: string | null
}

let cache: Promise<CompanyBranding | null> | null = null

/** Nombre y logo de la iglesia activa (se pide una sola vez por carga de página). */
export function useCompanyBranding() {
  const [branding, setBranding] = useState<CompanyBranding | null>(null)
  useEffect(() => {
    let alive = true
    cache ??= fetch("/api/branding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.ok ? ({ name: d.name as string, logoUrl: (d.logoUrl as string | null) ?? null }) : null))
      .catch(() => null)
    void cache.then((b) => alive && setBranding(b))
    return () => {
      alive = false
    }
  }, [])
  return branding
}
