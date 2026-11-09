import { brandImageFor, type BrandImage } from "@/lib/brand/ministry-images"
import { cn } from "@/lib/utils"

// Imagen de marca que cambia sola según el tema: la versión oscura en tema claro y la clara en
// tema oscuro (`dark:` sigue la clase del tema de la app). Las imágenes sin pareja van sobre una base
// clara (trazo oscuro o a color) u oscura (trazo claro) para que se lean igual en ambos temas.

export function ThemedImage({ image, className, alt = "" }: { image: BrandImage; className?: string; alt?: string }) {
  if (!image.paired) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image.forLight} alt={alt} className={className} draggable={false} />
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.forLight} alt={alt} className={cn(className, "dark:hidden")} draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.forDark} alt={alt} className={cn(className, "hidden dark:block")} draggable={false} />
    </>
  )
}

/** Sello del ministerio o evento (si tiene imagen de marca); no pinta nada si no la tiene. */
export function BrandMark({
  names,
  size = 56,
  className,
  fallback = null,
}: {
  /** Nombre (y tipo) con los que se busca la imagen: ministerio, tipo de evento… */
  names: (string | null | undefined)[]
  size?: number
  className?: string
  fallback?: React.ReactNode
}) {
  const image = brandImageFor(...names)
  if (!image) return <>{fallback}</>
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl", image.surface === "light" && "bg-white ring-1 ring-border", image.surface === "dark" && "bg-slate-900 ring-1 ring-border", className)}
      style={{ width: size, height: size }}
    >
      <ThemedImage image={image} className="size-full object-contain p-1" />
    </span>
  )
}
