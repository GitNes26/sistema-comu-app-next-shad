"use client"

import { useCompanyBranding } from "@/hooks/use-company-branding"

/** Logo y nombre de la iglesia para el encabezado de documentos impresos. */
export function DocumentBrand({ className }: { className?: string }) {
  const brand = useCompanyBranding()
  if (!brand || (!brand.logoUrl && !brand.name)) return null
  return (
    <div className={className ?? "flex items-center gap-3"}>
      {brand.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt="" className="h-12 max-w-32 object-contain" />
      )}
      {brand.name && <span className="text-sm font-semibold">{brand.name}</span>}
    </div>
  )
}
