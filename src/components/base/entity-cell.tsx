import { ThumbImage } from "@/components/base/thumb-image"
import { cn } from "@/lib/utils"

// Celda de "entidad" para listados: imagen (o inicial / ícono), título y una
// línea de apoyo. Productos, clientes, empleados, sedes, proveedores…

export function EntityCell({
  title,
  subtitle,
  image,
  icon,
  accent,
  muted = false,
  size = "md",
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  image?: string | null
  /** Ícono cuando no hay imagen (si no, se usa la inicial del título). */
  icon?: React.ReactNode
  /** Color del contorno del marcador sin imagen (p. ej. color de la categoría). */
  accent?: string
  /** Registro inactivo: título atenuado y tachado. */
  muted?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const box = size === "sm" ? "size-8 rounded-lg" : size === "lg" ? "size-14 rounded-2xl" : "size-10 rounded-xl"
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {image ? (
        <ThumbImage src={image} alt="" className={cn("shrink-0 object-cover", box)} />
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center text-sm font-semibold",
            box,
            accent ? "border-2" : "bg-muted text-muted-foreground"
          )}
          style={accent ? { borderColor: accent, color: accent } : undefined}
        >
          {icon ?? (title.trim().charAt(0).toUpperCase() || "?")}
        </span>
      )}
      <div className="min-w-0">
        <p className={cn("truncate font-medium", muted && "text-muted-foreground line-through decoration-muted-foreground/50")}>
          {title}
        </p>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}
