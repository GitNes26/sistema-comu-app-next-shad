import { cn } from "@/lib/utils"

// Indicador de carga de la marca: círculos concéntricos que se expanden (como el logotipo de
// la iglesia). Para pantallas y secciones; el Spinner pequeño sigue para botones y filas.

export function BrandLoader({ label = "Cargando…", className, size = 56 }: { label?: string | null; className?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-3 text-muted-foreground", className)}>
      <span className="relative inline-grid place-items-center text-primary" style={{ width: size, height: size }}>
        <span className="brand-pulse absolute inset-0 rounded-full border-2 border-current" />
        <span className="brand-pulse absolute inset-0 rounded-full border-2 border-current" style={{ animationDelay: "0.5s" }} />
        <span className="brand-pulse absolute inset-0 rounded-full border-2 border-current" style={{ animationDelay: "1s" }} />
        <span className="relative size-[28%] rounded-full bg-current" />
      </span>
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Cargando…</span>}
    </div>
  )
}
